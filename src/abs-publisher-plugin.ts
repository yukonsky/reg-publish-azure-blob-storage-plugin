import { streamToBuffer } from '@/utils';
import { DefaultAzureCredential } from '@azure/identity';
import {
  BlobItem,
  BlobServiceClient,
  ContainerClient,
  ContainerSASPermissions,
  SASProtocol,
  StoragePipelineOptions,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';
import * as fs from 'fs/promises';
import * as mimetics from 'mimetics';
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
  sasExpiryHour?: number;
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
  private blobServiceClient: BlobServiceClient;
  private containerClient!: ContainerClient;

  init(config: PluginCreateOptions<PluginConfig>): void {
    this.noEmit = config.noEmit;
    this.logger = config.logger;
    this.options = config;
    this.pluginConfig = config.options;
    const credential = this.pluginConfig.useDefaultCredential
      ? new DefaultAzureCredential()
      : this.createSharedKeyCredential();
    this.blobServiceClient = new BlobServiceClient(
      this.pluginConfig.url,
      credential,
      this.pluginConfig.options
    );
    this.containerClient = this.blobServiceClient.getContainerClient(
      this.getBucketName()
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async fetch(key: string): Promise<any> {
    return this.fetchInternal(key);
  }

  async publish(key: string): Promise<PublishResult> {
    const { indexFile } = await this.publishInternal(key);
    if (
      this.pluginConfig.sasExpiryHour === undefined ||
      this.pluginConfig.sasExpiryHour <= 0
    ) {
      return { reportUrl: this.createReportUrl(indexFile, key) };
    }

    const sas = await this.createBlobSas();
    await this.addSasHelperScripts(indexFile, key, sas);
    return { reportUrl: this.createReportUrl(indexFile, key, sas) };
  }

  protected async uploadItem(key: string, item: FileItem): Promise<FileItem> {
    const data = await fs.readFile(item.absPath);
    const fileInfo = await mimetics.parse(data);

    await this.containerClient.uploadBlockBlob(
      `${key}/${item.path}`,
      data,
      data.length,
      {
        blobHTTPHeaders: {
          blobContentType: fileInfo.mime,
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
        : files
            .filter(
              (item) =>
                !('ResourceType' in item.properties) ||
                item.properties.ResourceType === 'file'
            )
            .map((item) => ({
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

  private createSharedKeyCredential(): StorageSharedKeyCredential | undefined {
    const { accountName, accountKey } = this.pluginConfig;
    if (accountName === undefined || accountKey === undefined) {
      return;
    }
    return new StorageSharedKeyCredential(accountName, accountKey);
  }
  private async createBlobSas(): Promise<string | undefined> {
    const { accountName, useDefaultCredential, containerName, sasExpiryHour } =
      this.pluginConfig;
    if (
      accountName === undefined ||
      containerName === undefined ||
      sasExpiryHour === undefined
    ) {
      return;
    }

    const sasOptions = {
      permissions: ContainerSASPermissions.parse('r'),
      protocol: SASProtocol.Https,
      startsOn: new Date(),
      expiresOn: new Date(
        new Date().valueOf() + sasExpiryHour * 60 * 60 * 1000
      ),
      containerName,
    };

    if (useDefaultCredential) {
      return `?${generateBlobSASQueryParameters(
        sasOptions,
        await this.blobServiceClient.getUserDelegationKey(
          sasOptions.startsOn,
          sasOptions.expiresOn
        ),
        accountName
      )}`;
    }

    return `?${generateBlobSASQueryParameters(
      sasOptions,
      this.createSharedKeyCredential()
    )}`;
  }
  private createReportUrl(
    indexFile: FileItem,
    key: string,
    sas?: string
  ): string {
    return (
      indexFile &&
      `${this.pluginConfig.url}/${
        this.pluginConfig.containerName
      }/${this.resolveInBucket(key)}/${indexFile.path}${sas ?? ''}`
    );
  }
  private async addSasHelperScripts(
    indexFile: FileItem,
    key: string,
    sas: string
  ) {
    const content = (await fs.readFile(indexFile.absPath)).toString();
    const insertPos = content.indexOf('<body>') + '<body>'.length;
    const additionalScript = `<script lang='text/javascript' src='./sasHelper.js${sas}'></script>`;
    const modifiedContent =
      content.slice(0, insertPos) + additionalScript + content.slice(insertPos);
    this.logger.verbose(`Modified index.html:\n${modifiedContent}`);
    const data = Buffer.from(modifiedContent);
    await this.containerClient.uploadBlockBlob(
      `${key}/${indexFile.path}`,
      data,
      data.length,
      {
        blobHTTPHeaders: {
          blobContentType: indexFile.mimeType,
        },
      }
    );
    this.logger.verbose(`Updated ${key}/${indexFile.path}`);
    for (const fileName of ['sasHelper.js', 'requestInterceptor.js']) {
      const filePath = path.join(__dirname, 'helpers', 'sas', fileName);
      const fileBuffer = await fs.readFile(filePath);
      await this.containerClient.uploadBlockBlob(
        `${key}/${fileName}`,
        fileBuffer,
        fileBuffer.length,
        {
          blobHTTPHeaders: {
            blobContentType: 'text/javascript',
          },
        }
      );
      this.logger.verbose(`Uploaded from ${filePath} to ${key}/${fileName}`);
    }
  }
}
