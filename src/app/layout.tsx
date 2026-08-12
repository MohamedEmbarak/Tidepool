import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tidepool — an interactive descent',
  description:
    'A tactile, bioluminescent playground. Push the floats, squeeze the jellies, part the kelp, and wake whatever is sleeping in the dark.',
};

export const viewport: Viewport = {
  themeColor: '#05070f',
  width: 'device-width',
  initialScale: 1,
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
