import type { Ability, Card } from '@cinecards/cards';
import { CardView, type CardViewProps } from './CardView.tsx';
import { Icon } from './Icon.tsx';
import { AbilityText } from './Refs.tsx';

/** The energy an ability costs (bolt, star, fist, eye, with its count), as on the card sheet. */
export function PowerIcon({ power }: { power: Ability['power'] }) {
  if (!power) return null;
  return (
    <span className={'power p-' + power.icon}>
      <Icon name={power.icon} size={11} />
      {power.count > 1 ? <small>×{power.count}</small> : null}
    </span>
  );
}

/**
 * Story 14.3: the text box of a full card. Each ability as the sheet shows it (energy icon, type tag, effect text with
 * its keywords and cited cards), without the movie quote; flavor lines are left out. Nothing in it is tappable.
 */
export function CardText({ card }: { card: Card }) {
  const abilities = card.abilities.filter((ab) => ab.kind !== 'flavor');
  if (!abilities.length) return null;
  return (
    <span className="card-text">
      <span className="abilities">
        {abilities.map((ab, i) => (
          <span key={i} className={'ability k-' + ab.kind}>
            <PowerIcon power={ab.power} />
            <AbilityText card={card} ability={ab} still />
          </span>
        ))}
      </span>
    </span>
  );
}

/** Story 14.3: a full card (frame, cost token, picture, text box, ATQ/PV): the cards of the detailed hand. */
export function FullCard(props: Omit<CardViewProps, 'size' | 'text'>) {
  return <CardView {...props} size="big" text={<CardText card={props.card} />} />;
}
