import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daily Cryptograms",
  description: "A new cipher quote every day. Decode it letter by letter.",
};

// Applies the saved theme to <html> before paint to avoid a flash of the
// default theme on load. Mirrors the runtime logic in lib/theme.ts; kept
// inline (not a module) so it runs synchronously before React hydrates.
const themeInitScript = `try{
var d=document.documentElement,t=localStorage.getItem('dc-theme');
if(t==='dark'||t==='sepia'){d.classList.add('theme-'+t);}
else if(t==='custom'){
  var c=JSON.parse(localStorage.getItem('dc-theme-custom')||'null');
  if(c&&c.bg&&c.tile){
    var hx=function(h){h=h.replace('#','');return [parseInt(h.substr(0,2),16),parseInt(h.substr(2,2),16),parseInt(h.substr(4,2),16)];};
    var lum=function(x){var r=hx(x);return (0.299*r[0]+0.587*r[1]+0.114*r[2])/255;};
    var pad=function(n){var s=Math.round(Math.max(0,Math.min(255,n))).toString(16);return s.length<2?'0'+s:s;};
    var dk=function(x,f){var r=hx(x);return '#'+pad(r[0]*f)+pad(r[1]*f)+pad(r[2]*f);};
    if(lum(c.bg)<0.5)d.classList.add('theme-dark');
    d.style.setProperty('--bg',c.bg);
    d.style.setProperty('--ink',lum(c.bg)<0.5?'#f1f5f9':'#1f2937');
    d.style.setProperty('--tile-face',c.tile);
    d.style.setProperty('--tile-edge',dk(c.tile,0.85));
    d.style.setProperty('--tile-shadow',dk(c.tile,0.6));
    d.style.setProperty('--tile-border',dk(c.tile,0.78));
    d.style.setProperty('--tile-border-active',dk(c.tile,0.55));
    d.style.setProperty('--tile-text',lum(c.tile)<0.5?'#f8fafc':'#0f172a');
  }
}
}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // <html> is mutated by themeInitScript (classes + inline style) before
    // hydration, and <body> is sometimes mutated by browser extensions
    // (e.g. Video Speed Controller adds "vsc-initialized") — both produce
    // benign hydration mismatches that we don't want to patch up.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
