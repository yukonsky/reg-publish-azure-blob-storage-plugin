import { AbsContainerPreparer } from '@/abs-container-preparer';
import { AbsPublisherPlugin } from '@/abs-publisher-plugin';
import { PublisherPluginFactory } from 'reg-suit-interface';

export const pluginFactory: PublisherPluginFactory = () => {
  return {
    preparer: new AbsContainerPreparer(),
    publisher: new AbsPublisherPlugin(),
  };
};

export default pluginFactory;
