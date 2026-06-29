import type { Metadata } from 'next';
import Link from 'next/link';
import { Key, ArrowLeft, HelpCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'FAQ | DevVault',
  description: 'Frequently asked questions about DevVault security, encryption, and your master passphrase.',
};

const faqItems = [
  {
    question: 'What is DevVault?',
    answer:
      'DevVault is an encrypted vault for API keys, passwords, auth secrets, and other sensitive data. You generate or paste secrets, organize them by category, and retrieve them whenever you need them — from any device where you can sign in.',
  },
  {
    question: 'How is my data protected?',
    answer:
      'Your secret values are encrypted in your browser before they are saved. Only encrypted data is sent to our servers. The tagline says it simply: encrypted before it leaves your device.',
  },
  {
    question: 'Do you store my master passphrase?',
    answer:
      'No. Your master passphrase never leaves your browser and is never saved on our servers. We cannot look it up, reset it, or recover it for you.',
  },
  {
    question: 'If you don\u2019t store my passphrase, how do you verify it?',
    answer:
      'We don\u2019t compare your passphrase to a stored copy. Instead, your browser derives an encryption key from your passphrase and tries to decrypt a secret already in your vault. If decryption succeeds, the passphrase was correct. If it fails, the passphrase was wrong. On first use, a small verification record is created so future unlocks are fast — still encrypted, still unreadable by us.',
  },
  {
    question: 'Can DevVault staff read my secrets?',
    answer:
      'No. We only store encrypted blobs and basic metadata (name, category, dates). Without your master passphrase, those blobs cannot be decrypted — not by us, not by a database admin, not by anyone else.',
  },
  {
    question: 'What if I forget my master passphrase?',
    answer:
      'There is no recovery option. Forgetting it means your encrypted secrets cannot be unlocked. Store your master passphrase somewhere safe, separate from the secrets inside the vault.',
  },
  {
    question: 'What is the difference between my account password and my master passphrase?',
    answer:
      'Your account password (or Google/GitHub sign-in) gets you into DevVault. Your master passphrase unlocks the vault itself and is used to encrypt and decrypt your secrets. You need both: one to sign in, one to access your stored secrets.',
  },
  {
    question: 'What happens when I lock the vault or sign out?',
    answer:
      'Locking clears the encryption key from memory in your browser session. Your secrets stay encrypted on the server, but you must enter your master passphrase again to view or copy them. Signing out also ends your login session.',
  },
  {
    question: 'What exactly is stored on the server?',
    answer:
      'For each secret we store: a name, category, identifier prefix, encrypted value, encryption IV, and timestamps. Secret names are stored in plain text so you can search and browse your list. The actual secret values remain encrypted.',
  },
  {
    question: 'Can I use DevVault on my phone?',
    answer:
      'Yes. The interface is mobile-friendly. You sign in as usual and unlock the vault with your master passphrase on any supported browser.',
  },
  {
    question: 'What sign-in methods are supported?',
    answer:
      'You can sign in with Google, GitHub, or email and password. Your vault encryption works the same regardless of how you sign in.',
  },
];

export default function FaqPage() {
  return (
    <main className="login-page">
      <div className="login-blob login-blob-top" />
      <div className="login-blob login-blob-bottom" />

      <div className="glass-panel login-card faq-page">
        <div className="profile-top-bar">
          <Link href="/login" className="profile-back-link">
            <ArrowLeft size={16} />
            Back to sign in
          </Link>
        </div>

        <div className="profile-brand">
          <div className="login-logo">
            <HelpCircle size={26} color="#ffffff" />
          </div>
          <h1 className="login-title">FAQ</h1>
          <p className="login-subtitle">
            Common questions about security, encryption, and how DevVault works.
          </p>
        </div>

        <div className="faq-list">
          {faqItems.map((item) => (
            <details key={item.question} className="faq-item">
              <summary className="faq-question">{item.question}</summary>
              <p className="faq-answer">{item.answer}</p>
            </details>
          ))}
        </div>

        <div className="faq-footer-note">
          <Key size={14} style={{ flexShrink: 0, transform: 'rotate(-45deg)' }} />
          <span>Still have questions? Sign in and explore — your vault stays encrypted either way.</span>
        </div>
      </div>
    </main>
  );
}
