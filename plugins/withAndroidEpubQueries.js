const { withAndroidManifest } = require('expo/config-plugins');

const EPUB_MIME_TYPES = ['application/epub+zip', 'application/epub'];

function viewIntent(mimeType) {
  return {
    action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
    data: [{ $: { 'android:mimeType': mimeType } }],
  };
}

/** Lets a release build see installed EPUB readers when opening a book. */
function withAndroidEpubQueries(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest.queries?.length) manifest.queries = [{}];
    const query = manifest.queries[0];
    const intents = query.intent ?? [];
    for (const mimeType of EPUB_MIME_TYPES) {
      const listed = intents.some((intent) =>
        intent.data?.some((entry) => entry.$?.['android:mimeType'] === mimeType),
      );
      if (!listed) intents.push(viewIntent(mimeType));
    }
    query.intent = intents;
    return config;
  });
}

module.exports = withAndroidEpubQueries;
