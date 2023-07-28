import { streamToBuffer } from '@/utils';
import { TokenCredential } from '@azure/core-auth';
import {
  AnonymousCredential,
  BlobDownloadResponseParsed,
  BlobItem,
  BlobServiceClient,
  ContainerClient,
  StoragePipelineOptions,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  PluginCreateOptions,
  PublishResult,
  PublisherPlugin,
  WorkingDirectoryInfo,
} from 'reg-suit-interface';
import {
  AbstractPublisher,
  FileItem,
  ObjectListResult,
  RemoteFileItem,
} from 'reg-suit-util';
import { promisify } from 'util';
import * as zlib from 'zlib';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const GZIP_CONTENT_TYPE = 'application/gzip';

export interface PluginConfig {
  url: string;
  containerName: string;
  credential:
    | StorageSharedKeyCredential
    | AnonymousCredential
    | TokenCredential;
  options?: StoragePipelineOptions;
  pattern?: string;
  pathPrefix?: string;
}

export class AbsPublisherPlugin
  extends AbstractPublisher
  implements PublisherPlugin<PluginConfig>
{
  name = 'reg-publish-azure-blob-storage-plugin';

  private options!: PluginCreateOptions<PluginConfig>;
  private pluginConfig!: PluginConfig;
  private containerClient!: ContainerClient;

  init(config: PluginCreateOptions<PluginConfig>): void {
    this.noEmit = config.noEmit;
    this.logger = config.logger;
    this.options = config;
    this.pluginConfig = config.options;
    const blobServiceClient = new BlobServiceClient(
      this.pluginConfig.url,
      this.pluginConfig.credential,
      this.pluginConfig.options
    );
    this.containerClient = blobServiceClient.getContainerClient(
      this.getBucketName()
    );
  }

  async fetch(key: string): Promise<any> {
    return this.fetchInternal(key);
  }

  async publish(key: string): Promise<PublishResult> {
    const { indexFile } = await this.publishInternal(key);
    const reportUrl =
      indexFile &&
      `${this.pluginConfig.url}/${this.resolveInBucket(key)}/${indexFile.path}`;
    return { reportUrl };
  }

  protected async uploadItem(key: string, item: FileItem): Promise<FileItem> {
    const content = await fs.readFile(item.absPath);
    const data = await gzip(content);

    await this.containerClient.uploadBlockBlob(
      `${key}/${item.path}`,
      data,
      data.length,
      {
        blobHTTPHeaders: {
          blobContentType: GZIP_CONTENT_TYPE,
        },
      }
    );
    this.logger.verbose(`Uploaded from ${item.absPath} to ${key}/${item.path}`);
    return item;
  }

  protected async downloadItem(
    remoteItem: RemoteFileItem,
    item: FileItem
  ): Promise<FileItem> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(
      remoteItem.remotePath
    );
    const blobDownloadResponse = await blockBlobClient.download();
    const content = await this.gunzipIfNeed(blobDownloadResponse);
    const dirName = path.dirname(item.absPath);
    await fs.mkdir(dirName, { recursive: true });
    await fs.writeFile(item.absPath, content);
    this.logger.verbose(
      `Downloaded from ${remoteItem.remotePath} to ${item.absPath}`
    );
    return item;
  }

  private async gunzipIfNeed(
    blobDownloadResponse: BlobDownloadResponseParsed
  ): Promise<Buffer> {
    if (blobDownloadResponse.contentType === GZIP_CONTENT_TYPE) {
      const buffer = await streamToBuffer(
        blobDownloadResponse.readableStreamBody
      );
      return await gunzip(buffer);
    }
    return await streamToBuffer(blobDownloadResponse.readableStreamBody);
  }

  protected async listItems(
    lastKey: string,
    prefix: string
  ): Promise<ObjectListResult> {
    const iterator = this.containerClient.listBlobsFlat({ prefix }).byPage({
      maxPageSize: 1000,
      continuationToken: lastKey === '' ? undefined : lastKey,
    });
    const response = await iterator.next();
    const nextMarker = response.value.continuationToken;
    const files: BlobItem[] | undefined | null =
      response.value.segment.blobItems;
    return {
      isTruncated: response.done,
      contents: !files
        ? []
        : files.map((item) => ({
            key: item.name,
          })),
      nextMarker,
    };
  }
  protected getWorkingDirs(): WorkingDirectoryInfo {
    return this.options.workingDirs;
  }
  protected getLocalGlobPattern(): string {
    return this.pluginConfig.pattern;
  }
  protected getBucketName(): string {
    return this.pluginConfig.containerName;
  }
  protected getBucketRootDir(): string | undefined {
    return this.pluginConfig.pathPrefix;
  }
}
