import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { declineInvite, takeInvite, useHub, type ReceivedInvite } from './hub.ts';

const left = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Invitations received (story 8.3): a card at the top of the screen, "Pseudo t'invite à un duel" with "Rejoindre"
 * and "Refuser" and a quiet countdown; at most 3 shown, newest first. Shown on the home screen and the waiting
 * room, not on the table.
 */
export function InviteToast({ onJoin }: { onJoin: (invite: ReceivedInvite) => void }) {
  const { invites } = useHub();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!invites.length) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [invites.length]);
  const shown = invites
    .filter((i) => i.expiresAt > now)
    .slice(-3)
    .reverse();
  if (!shown.length) return null;
  return createPortal(
    <div className="invite-stack" aria-live="polite">
      {shown.map((i) => (
        <div key={i.inviteId} className="invite-toast parchment" role="alert">
          <p className="invite-text">
            <strong>{i.from.nickname}</strong> t’invite à un duel
            <small className="invite-left" aria-label={`Expire dans ${left(i.expiresAt - now)}`}>
              {left(i.expiresAt - now)}
            </small>
          </p>
          <div className="row invite-actions">
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                takeInvite(i.inviteId);
                onJoin(i);
              }}
            >
              Rejoindre
            </button>
            <button type="button" className="btn ghost" onClick={() => declineInvite(i.inviteId)}>
              Refuser
            </button>
          </div>
        </div>
      ))}
    </div>,
    document.body,
  );
}
