import './globals.css';

export const metadata = {
  title: 'VEXEL AI - Premium E-Commerce AI Background Generator',
  description: 'Generate professional e-commerce product advertisement backgrounds using Cloudflare AI and OpenAI Vision API.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="antialiased bg-dark-bg text-zinc-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
