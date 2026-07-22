// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025  Philipp Emanuel Weidmann <pew@worldwidemann.com>

import { RadioCards, SegmentedControl, Text } from "@radix-ui/themes";
import { GiFemale, GiMale } from "react-icons/gi";
import { useShallow } from "zustand/shallow";
import ImageOption from "@/components/ImageOption";
import WizardStep from "@/components/WizardStep";
import { type Gender, type Race, useStateStore } from "@/lib/state";
import { Race as RaceEnum } from "@/lib/schemas";

export default function CharacterSelect({ onNext, onBack }: { onNext?: () => void; onBack?: () => void }) {
  const { gender, race, setState } = useStateStore(
    useShallow((state) => ({
      gender: state.protagonist.gender,
      race: state.protagonist.race,
      setState: state.set,
    })),
  );

  return (
    <WizardStep title="Character" onNext={onNext} onBack={onBack}>
      <SegmentedControl.Root
        value={gender}
        onValueChange={(value: Gender) =>
          setState((state) => {
            state.protagonist.gender = value;
          })
        }
        className="w-full"
        size="3"
        mb="5"
      >
        <SegmentedControl.Item value="male">
          <GiMale className="inline mt-[-7px]" size="25" /> <Text size="6">Male</Text>
        </SegmentedControl.Item>
        <SegmentedControl.Item value="female">
          <GiFemale className="inline mt-[-7px]" size="25" /> <Text size="6">Female</Text>
        </SegmentedControl.Item>
      </SegmentedControl.Root>

      <RadioCards.Root
        value={race}
        onValueChange={(value: Race) =>
          setState((state) => {
            state.protagonist.race = value;
          })
        }
        columns="5"
      >
        {RaceEnum.options.map((raceValue) => (
            <ImageOption
              key={raceValue}
              title={raceValue.charAt(0).toUpperCase() + raceValue.slice(1)}
              image={`${gender}-${raceValue}`}
              value={raceValue}
              size="h-75 w-45"
            />
          ))}
      </RadioCards.Root>
    </WizardStep>
  );
}

