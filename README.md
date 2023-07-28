# reg-publish-azure-blob-storage-plugin

## Usage

```bash
pnpm i -D @yukonsky/reg-publish-azure-blob-storage-plugin
reg-suit prepare -p publish-filesystem
```

## Configure

```typescript
{
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
```

## License

This library is under [MIT](LICENSE) license.
