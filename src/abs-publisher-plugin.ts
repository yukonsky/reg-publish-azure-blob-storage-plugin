import { streamToBuffer } from '@/utils';
import { DefaultAzureCredential } from '@azure/identity';
import {
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

export interface PluginConfig {
  url: string;
  containerName: string;
  useDefaultCredential: boolean;
  accountName?: string;
  accountKey?: string;
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
    const credential = this.pluginConfig.useDefaultCredential
      ? new DefaultAzureCredential()
      : new StorageSharedKeyCredential(
          this.pluginConfig.accountName,
          this.pluginConfig.accountKey
        );
    const blobServiceClient = new BlobServiceClient(
      this.pluginConfig.url,
      credential,
      this.pluginConfig.options
    );
    this.containerClient = blobServiceClient.getContainerClient(
      this.getBucketName()
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    const data = await fs.readFile(item.absPath);

    await this.containerClient.uploadBlockBlob(
      `${key}/${item.path}`,
      data,
      data.length
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
    const content = await streamToBuffer(
      blobDownloadResponse.readableStreamBody
    );
    const dirName = path.dirname(item.absPath);
    await fs.mkdir(dirName, { recursive: true });
    await fs.writeFile(item.absPath, content);
    this.logger.verbose(
      `Downloaded from ${remoteItem.remotePath} to ${item.absPath}`
    );
    return item;
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
