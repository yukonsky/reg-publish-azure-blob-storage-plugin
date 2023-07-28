import { AbsContainerPreparer } from '@/abs-container-preparer';
import { AbsPublisherPlugin } from '@/abs-publisher-plugin';
import { TokenCredential } from '@azure/core-auth';
import {
  AnonymousCredential,
  BlobServiceClient,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import * as assert from 'assert';
import * as dotenv from 'dotenv';
import * as glob from 'glob';
import * as path from 'path';
import { createLogger } from 'reg-suit-util';

dotenv.config();

const AZURE_STORAGE_ENDPOINT = process.env.AZURE_STORAGE_ENDPOINT;
const AZURE_STORAGE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const AZURE_STORAGE_ACCOUNT_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const preparer = new AbsContainerPreparer();

const logger = createLogger();
logger.setLevel('verbose');
const baseConf = {
  coreConfig: { actualDir: '', workingDir: '' },
  logger,
  noEmit: false,
};

const dirsA = {
  base: path.join(__dirname, 'report-fixture'),
  actualDir: path.join(__dirname, 'report-fixture', 'dir_a'),
  expectedDir: path.join(__dirname, 'report-fixture', 'dir_b'),
  diffDir: '',
};

const dirsB = {
  base: path.join(__dirname, 'report-fixture-expected'),
  actualDir: path.join(__dirname, 'report-fixture-expected', 'dir_a'),
  expectedDir: path.join(__dirname, 'report-fixture-expected', 'dir_b'),
  diffDir: '',
};

async function after(
  url: string,
  containerName: string,
  credential: StorageSharedKeyCredential | AnonymousCredential | TokenCredential
) {
  const blobServiceClient = new BlobServiceClient(url, credential);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  await containerClient.delete();
}

async function case1() {
  const { url, containerName, credential } = await preparer.prepare({
    ...baseConf,
    options: {
      url: AZURE_STORAGE_ENDPOINT,
      createContainer: true,
      containerName: 'test',
      accountName: AZURE_STORAGE_ACCOUNT_NAME,
      accountKey: AZURE_STORAGE_ACCOUNT_KEY,
    },
    workingDirs: dirsA,
  });
  try {
    const plugin = new AbsPublisherPlugin();
    plugin.init({
      ...baseConf,
      options: {
        url: AZURE_STORAGE_ENDPOINT,
        containerName,
        credential,
      },
      workingDirs: dirsA,
    });
    const { reportUrl } = await plugin.publish('abcdef12345');
    if (!reportUrl) {
      throw new Error('no report url');
    }

    plugin.init({
      ...baseConf,
      options: {
        url: AZURE_STORAGE_ENDPOINT,
        containerName,
        credential,
      },
      workingDirs: dirsB,
    });
    await plugin.fetch('abcdef12345');

    const list = glob.sync('dir_b/sample01.png', { cwd: dirsB.base });
    assert.equal(list[0], 'dir_b/sample01.png');
    logger.info(reportUrl);
    await after(url, containerName, credential);
  } catch (e) {
    await after(url, containerName, credential);
    throw e;
  }
}

async function main() {
  try {
    await case1();
    // eslint-disable-next-line no-console
    console.log(' 🌟  Test was ended successfully! 🌟 ');
    process.exit(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  }
}

main();
