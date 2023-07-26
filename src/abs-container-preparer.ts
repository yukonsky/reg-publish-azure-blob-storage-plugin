import {
  PluginCreateOptions,
  PluginPreparer,
  PreparerQuestions,
} from 'reg-suit-interface';
import { PluginConfig } from './abs-publisher-plugin';

export interface SetupInquireResult {}

export class AbsContainerPreparer
  implements PluginPreparer<SetupInquireResult, PluginConfig>
{
  inquire(): PreparerQuestions {
    throw new Error('Method not implemented.');
  }
  prepare(
    option: PluginCreateOptions<SetupInquireResult>
  ): Promise<PluginConfig> {
    throw new Error('Method not implemented.');
  }
}
