import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/site/JsonLd';
import { PageShell } from '@/components/site/PageShell';
import { getPosts } from '@/lib/site/blog';
import { absoluteUrl, isLocale, localizedPath } from '@/lib/site/config';
import { getCopy } from '@/lib/site/content';
import { localizedMetadata } from '@/lib/site/metadata';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = await getCopy(locale);
  return localizedMetadata({
    locale,
    title: copy.seo.blogTitle,
    description: copy.seo.blogDescription,
    path: '/blog',
    rssTitle: copy.blog.title,
  });
}

export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params;
  if (!isLocale(value)) notFound();
  const copy = await getCopy(value);
  const posts = getPosts(value).sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));

  return (
    <PageShell locale={value} copy={copy} currentPath="/blog">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: copy.seo.blogTitle,
        description: copy.seo.blogDescription,
        url: absoluteUrl(value, '/blog'),
        inLanguage: value,
        publisher: { '@type': 'Organization', name: 'Vella', url: absoluteUrl(value) },
        blogPost: posts.map((post) => ({
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.description,
          datePublished: post.publishedAt,
          url: absoluteUrl(value, `/blog/${post.slug}`),
        })),
      }} />
      <section className="subpage-hero blog-hero">
        <div className="hero-ambient ambient-one"></div>
        <div className="shell subpage-hero-inner">
          <p className="eyebrow eyebrow-light">{copy.blog.eyebrow}</p>
          <h1>{copy.blog.title}</h1>
          <p>{copy.blog.body}</p>
        </div>
      </section>
      <section className="section section-ivory">
        <div className="shell">
          <div className="section-heading"><p className="eyebrow">{copy.blog.latest}</p></div>
          <div className="blog-grid">
            {posts.map((post, index) => (
              <article className={index === 0 ? 'blog-card blog-card-featured' : 'blog-card'} key={post.slug}>
                <div className="blog-card-visual"><span>{String(index + 1).padStart(2, '0')} · {post.category}</span></div>
                <div className="blog-card-content">
                  <div className="blog-meta"><span>{post.dateLabel}</span><span>·</span><span>{post.readTime}</span></div>
                  <h2>{post.title}</h2>
                  <p>{post.description}</p>
                  <Link className="text-link" href={localizedPath(value, `/blog/${post.slug}`)}>{copy.blog.readArticle}<span aria-hidden="true">→</span></Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
