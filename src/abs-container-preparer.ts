import { TokenCredential } from '@azure/core-auth';
import { DefaultAzureCredential } from '@azure/identity';
import {
  AnonymousCredential,
  BlobServiceClient,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import {
  PluginCreateOptions,
  PluginLogger,
  PluginPreparer,
  PreparerQuestions,
} from 'reg-suit-interface';
import { v4 as uuid } from 'uuid';
import { PluginConfig } from './abs-publisher-plugin';

const CONTAINER_PREFIX = 'reg-publish-container';

export interface SetupInquireResult {
  createContainer: boolean;
  useDefaultCredential: boolean;
  url: string;
  accountName?: string;
  accountKey?: string;
  containerName?: string;
}

export class AbsContainerPreparer
  implements PluginPreparer<SetupInquireResult, PluginConfig>
{
  private logger: PluginLogger;
  inquire(): PreparerQuestions {
    return [
      {
        name: 'createContainer',
        type: 'confirm',
        message: 'Create a new Azure Blob Storage container',
        default: true,
      },
      {
        name: 'useDefaultCredential',
        type: 'confirm',
        message: 'Use default Azure credential',
        default: true,
      },
      {
        name: 'accountName',
        type: 'input',
        message: 'Azure Blob Storage Shared Key Credential: Account Name',
        when: (ctx: { useDefaultCredential: boolean }) =>
          !ctx.useDefaultCredential,
      },
      {
        name: 'accountKey',
        type: 'input',
        message: 'Azure Blob Storage Shared Key Credential: Account Key',
        when: (ctx: { useDefaultCredential: boolean }) =>
          !ctx.useDefaultCredential,
      },
      {
        name: 'url',
        type: 'input',
        message: 'Azure Blob Storage URL',
        default: (ctx: { accountName: string }) =>
          `https://${ctx.accountName}.blob.core.windows.net`,
        when: (ctx: { createContainer: boolean }) => !ctx.createContainer,
      },
      {
        name: 'containerName',
        type: 'input',
        message: 'Existing container name',
        when: (ctx: { createContainer: boolean }) => !ctx.createContainer,
      },
    ];
  }

  async prepare(
    option: PluginCreateOptions<SetupInquireResult>
  ): Promise<PluginConfig> {
    this.logger = option.logger;
    const options = option.options;
    if (!options.createContainer) {
      return {
        url: options.url,
        containerName: options.containerName,
        useDefaultCredential: options.useDefaultCredential,
        accountName: options.accountName,
        accountKey: options.accountKey,
      };
    } else {
      const id = uuid();
      const containerName = `${CONTAINER_PREFIX}-${id}`;
      if (option.noEmit) {
        this.logger.info(
          `Skip creating container ${containerName} because --no-emit option is specified.`
        );
        return {
          url: options.url,
          containerName,
          useDefaultCredential: options.useDefaultCredential,
          accountName: options.accountName,
          accountKey: options.accountKey,
        };
      }
      this.logger.info(
        `Create new Azure Blob Storage container: ${this.logger.colors.magenta(
          containerName
        )}`
      );
      const spinner = this.logger.getSpinner('Creating container...');
      spinner.start();
      const credential = options.useDefaultCredential
        ? new DefaultAzureCredential()
        : new StorageSharedKeyCredential(
            options.accountName,
            options.accountKey
          );
      await this.createContainer(options.url, containerName, credential);
      spinner.stop();
      this.logger.info(
        `Container ${this.logger.colors.magenta(containerName)} is created.`
      );
      return {
        url: options.url,
        containerName,
        useDefaultCredential: options.useDefaultCredential,
        accountName: options.accountName,
        accountKey: options.accountKey,
      };
    }
  }

  async createContainer(
    url: string,
    containerName: string,
    credential:
      | StorageSharedKeyCredential
      | AnonymousCredential
      | TokenCredential
  ): Promise<void> {
    const blobServiceClient = new BlobServiceClient(url, credential);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.create();
  }
}
