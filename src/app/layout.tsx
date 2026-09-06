import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tidepool — an interactive descent',
  description:
    'Explore a continuous underwater world. Open shells, uncover lost objects, and collect six memories to awaken a secret in the deep.',
};

export const viewport: Viewport = {
  themeColor: '#05070f',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // Zoom is left enabled on purpose. Pinch-zoom is an accessibility
  // affordance, and the scenes handle their own gestures via touch-action
  // rather than by taking it away from the user.
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
