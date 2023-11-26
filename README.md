# reg-publish-azure-blob-storage-plugin

## Usage

```bash
pnpm i -D reg-publish-azure-blob-storage-plugin@npm:@yukonsky/reg-publish-azure-blob-storage-plugin
reg-suit prepare -p publish-azure-blob-storage
```

## Configure

```typescript
{
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
```

## License

This library is under [MIT](LICENSE) license.
