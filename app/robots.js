export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/', '/onboarding'],
    },
    sitemap: 'https://www.getmoneysorted.co.uk/sitemap.xml',
  }
}
