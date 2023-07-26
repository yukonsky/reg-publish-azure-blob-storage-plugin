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

export interface PluginConfig {}

export class AbsPublisherPlugin
  extends AbstractPublisher
  implements PublisherPlugin<PluginConfig>
{
  protected uploadItem(key: string, item: FileItem): Promise<FileItem> {
    throw new Error('Method not implemented.');
  }
  protected downloadItem(
    remoteItem: RemoteFileItem,
    item: FileItem
  ): Promise<FileItem> {
    throw new Error('Method not implemented.');
  }
  protected listItems(
    lastKey: string,
    prefix: string
  ): Promise<ObjectListResult> {
    throw new Error('Method not implemented.');
  }
  protected getWorkingDirs(): WorkingDirectoryInfo {
    throw new Error('Method not implemented.');
  }
  protected getLocalGlobPattern(): string {
    throw new Error('Method not implemented.');
  }
  protected getBucketName(): string {
    throw new Error('Method not implemented.');
  }
  protected getBucketRootDir(): string {
    throw new Error('Method not implemented.');
  }
  fetch(key: string): Promise<any> {
    throw new Error('Method not implemented.');
  }
  publish(key: string): Promise<PublishResult> {
    throw new Error('Method not implemented.');
  }
  init(config: PluginCreateOptions<PluginConfig>): void {
    throw new Error('Method not implemented.');
  }
  name = 'reg-publish-azure-blob-storage-plugin';
}
