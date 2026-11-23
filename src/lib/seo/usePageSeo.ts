import { useEffect } from 'react';

interface PageSeoOptions {
  title: string;
  description?: string;
  path?: string;
}

/**
 * Updates document title, meta description, canonical URL, and OpenGraph tags dynamically per route
 * for clean browser tabs and crawler rendering.
 */
export function usePageSeo({ title, description, path }: PageSeoOptions): void {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    const updateMeta = (selector: string, content?: string) => {
      if (!content) return;
      const el = document.querySelector<HTMLMetaElement>(selector);
      if (el) el.setAttribute('content', content);
    };

    updateMeta('meta[name="description"]', description);
    updateMeta('meta[property="og:title"]', title);
    updateMeta('meta[property="og:description"]', description);
    updateMeta('meta[name="twitter:title"]', title);
    updateMeta('meta[name="twitter:description"]', description);

    if (typeof window !== 'undefined') {
      const targetPath = path ?? window.location.pathname;
      const canonicalUrl = `${window.location.origin}${targetPath}`;
      const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (canonical) {
        canonical.setAttribute('href', canonicalUrl);
      }
      updateMeta('meta[property="og:url"]', canonicalUrl);
    }

    return () => {
      document.title = prevTitle;
    };
  }, [title, description, path]);
}
