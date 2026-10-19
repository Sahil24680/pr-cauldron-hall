import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import type { Appearance, CastKey } from "../../shared/cast";
import { resetCastMember, updateCastMember, useCastMember } from "../cast/castStore";
import { CharacterPreview } from "../world/characters/human";
import {
  ACCENT_OPTIONS,
  BODY_OPTIONS,
  CAPE_OPTIONS,
  CAST_CARD_COLORS,
  CAST_OPTIONS,
  GLASSES_OPTIONS,
  HAIR_OPTIONS_BY_BUILD,
  HAIR_SWATCHES,
  OUTFIT_OPTIONS,
  type Option,
  PATTERN_OPTIONS,
  PHYSIQUE_OPTIONS,
  SKIN_SWATCHES,
  STAFF_OPTIONS,
  type Swatch,
  WAND_OPTIONS,
} from "./appearanceOptions";

function Row({ label, children }: { label: string; children: ReactNode }) {
  const labelId = useId();
  return (
    <fieldset className="appearance-row" aria-labelledby={labelId}>
      <span id={labelId} className="appearance-label">
        {label}
      </span>
      <div className="appearance-choices">{children}</div>
    </fieldset>
  );
}

type ChoicesProps<T extends string> = { options: Option<T>[]; value: T; onChange: (value: T) => void };

function Choices<T extends string>({ options, value, onChange }: ChoicesProps<T>) {
  return options.map((option) => (
    <button key={option.id} type="button" className="chip" aria-pressed={value === option.id} onClick={() => onChange(option.id)}>
      {option.label}
    </button>
  ));
}

type SwatchesProps = { label: string; swatches: Swatch[]; value: string; disabled?: boolean; onChange: (hex: string) => void };

function Swatches({ label, swatches, value, disabled = false, onChange }: SwatchesProps) {
  return (
    <>
      {swatches.map((swatch) => (
        <button
          key={swatch.hex}
          type="button"
          className="swatch"
          style={{ background: swatch.hex }}
          aria-label={swatch.name}
          title={swatch.name}
          aria-pressed={value.toLowerCase() === swatch.hex}
          disabled={disabled}
          onClick={() => onChange(swatch.hex)}
        />
      ))}
      <input
        type="color"
        className="swatch-picker"
        aria-label={`${label}, any color`}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </>
  );
}

function HatIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path fill="currentColor" d="M27 4c-6 6-11 18-13 30H8c-2 0-3 1-3 2.5S6 40 9 40h30c3 0 4-1.5 4-3s-1-3-3-3h-6c-1-9-2-16-1-22 1-3 3-5 6-6-4-1-8-1-12-2z" />
    </svg>
  );
}

function CastPicker({ returnTo, onPick }: { returnTo: CastKey | null; onPick: (castKey: CastKey) => void }) {
  const returnCard = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    returnCard.current?.focus();
  }, []);

  return (
    <ul className="cast-cards">
      {CAST_OPTIONS.map((option) => (
        <li key={option.id}>
          <button ref={option.id === returnTo ? returnCard : undefined} type="button" className="cast-card" onClick={() => onPick(option.id)}>
            <span className="cast-card-arch" style={{ background: CAST_CARD_COLORS[option.id] }} aria-hidden="true">
              <HatIcon />
            </span>
            {option.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

function MemberEditor({ castKey, onBack }: { castKey: CastKey; onBack: () => void }) {
  const member = useCastMember(castKey);
  const update = (change: Partial<Appearance>) => updateCastMember(castKey, change);
  const backButton = useRef<HTMLButtonElement>(null);
  const name = CAST_OPTIONS.find((option) => option.id === castKey)?.label;

  useEffect(() => {
    backButton.current?.focus();
  }, []);

  return (
    <div className="appearance-edit">
      <div className="appearance-heading">
        <button ref={backButton} type="button" className="appearance-back" onClick={onBack}>
          ‹ Back
        </button>
        <h3>{name}</h3>
      </div>
      <div className="mirror">
        <div className="mirror-glass">
          <CharacterPreview castKey={castKey} />
        </div>
      </div>
      <div className="appearance-controls">
        <Row label="Body">
          <Choices options={BODY_OPTIONS} value={member.build} onChange={(build) => update({ build })} />
        </Row>
        <Row label="Build">
          <Choices options={PHYSIQUE_OPTIONS} value={member.physique} onChange={(physique) => update({ physique })} />
        </Row>
        <Row label="Hair">
          <Choices options={HAIR_OPTIONS_BY_BUILD[member.build]} value={member.hair} onChange={(hair) => update({ hair })} />
        </Row>
        <Row label="Hair color">
          <Swatches label="Hair color" swatches={HAIR_SWATCHES} value={member.hairColor} onChange={(hairColor) => update({ hairColor })} />
        </Row>
        <Row label="Skin">
          <Swatches label="Skin" swatches={SKIN_SWATCHES} value={member.skin} onChange={(skin) => update({ skin })} />
        </Row>
        {member.build === "male" && (
          <Row label="Beard">
            <button type="button" className="chip" aria-pressed={member.beard} onClick={() => update({ beard: !member.beard })}>
              {member.beard ? "On" : "Off"}
            </button>
            <Swatches
              label="Beard color"
              swatches={HAIR_SWATCHES}
              value={member.beardColor}
              disabled={!member.beard}
              onChange={(beardColor) => update({ beardColor })}
            />
          </Row>
        )}
        <Row label="Glasses">
          <Choices options={GLASSES_OPTIONS} value={member.glasses} onChange={(glasses) => update({ glasses })} />
        </Row>
        <Row label="Outfit">
          <Choices options={OUTFIT_OPTIONS} value={member.outfit} onChange={(outfit) => update({ outfit })} />
        </Row>
        <Row label="Pattern">
          <Choices options={PATTERN_OPTIONS} value={member.pattern} onChange={(pattern) => update({ pattern })} />
        </Row>
        <Row label="Accents">
          {ACCENT_OPTIONS.map((accent) => (
            <button
              key={accent.id}
              type="button"
              className="chip"
              aria-pressed={member.accents[accent.id]}
              onClick={() => update({ accents: { ...member.accents, [accent.id]: !member.accents[accent.id] } })}
            >
              {accent.label}
            </button>
          ))}
        </Row>
        <Row label="Wand">
          <Choices options={WAND_OPTIONS} value={member.wand} onChange={(wand) => update({ wand })} />
        </Row>
        <Row label="Cape">
          <Choices options={CAPE_OPTIONS} value={member.cape} onChange={(cape) => update({ cape })} />
        </Row>
        <Row label="Staff">
          <Choices options={STAFF_OPTIONS} value={member.staff} onChange={(staff) => update({ staff })} />
        </Row>

        <button type="button" className="appearance-reset" onClick={() => resetCastMember(castKey)}>
          Reset
        </button>
      </div>
    </div>
  );
}

export function AppearanceEditor() {
  const [castKey, setCastKey] = useState<CastKey | null>(null);
  const [lastEdited, setLastEdited] = useState<CastKey | null>(null);
  if (castKey === null) {
    return <CastPicker returnTo={lastEdited} onPick={setCastKey} />;
  }
  return (
    <MemberEditor
      castKey={castKey}
      onBack={() => {
        setLastEdited(castKey);
        setCastKey(null);
      }}
    />
  );
}
