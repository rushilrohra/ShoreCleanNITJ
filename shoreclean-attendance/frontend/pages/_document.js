import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta
          name="description"
          content="ShoreClean — Digitizing Coastal Conservation. Connecting volunteers, NGOs, and donors to measurable beach cleanup impact across India."
        />
        <meta name="theme-color" content="#0c2340" />
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌊</text></svg>"
        />
        {/* AOS - Animate On Scroll */}
        <link rel="stylesheet" href="https://unpkg.com/aos@2.3.4/dist/aos.css" />
      </Head>
      <body>
        <Main />
        <NextScript />
        <script src="https://unpkg.com/aos@2.3.4/dist/aos.js"></script>
      </body>
    </Html>
  );
}
