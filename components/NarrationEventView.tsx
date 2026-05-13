// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025  Philipp Emanuel Weidmann <pew@worldwidemann.com>

import { Box, HoverCard, Link, Text } from "@radix-ui/themes";
import { useCallback, useMemo } from "react";
import Markdown from "react-markdown";
import { useShallow } from "zustand/shallow";
import { sanitizeForDisplay } from "@/lib/sanitize";
import { type NarrationEvent, useStateStore } from "@/lib/state";
import CharacterView from "./CharacterView";

export default function NarrationEventView({ event }: { event: NarrationEvent }) {
  const { characters } = useStateStore(
    useShallow((state) => ({
      characters: state.characters,
    })),
  );

  // Security: Sanitize LLM-generated text before rendering as markdown.
  // Removes potential script injection patterns while preserving prose.
  const markdown = sanitizeForDisplay(event.text).replaceAll(/".*?(?:"|$)/g, "*$&*");

  const NameView = useCallback(
    // biome-ignore lint/suspicious/noExplicitAny: The correct type is private in react-markdown.
    (props: any) => {
      const { children } = props;

      if (typeof children === "string") {
        const possessiveSuffix = /'s?$/;
        const name = children.replace(possessiveSuffix, "");

        for (const character of characters) {
          if (character.name === name || character.name.split(" ")[0] === name) {
            return (
              <HoverCard.Root>
                <HoverCard.Trigger>
                  <Link color="blue" href="#" onClick={(event) => event.preventDefault()}>
                    {children}
                  </Link>
                </HoverCard.Trigger>
                <HoverCard.Content maxWidth="40rem">
                  <Box p="2">
                    <CharacterView character={character} />
                  </Box>
                </HoverCard.Content>
              </HoverCard.Root>
            );
          }
        }
      }

      return <strong>{children}</strong>;
    },
    [characters],
  );

  const DialogueView = useCallback(
    // biome-ignore lint/suspicious/noExplicitAny: The correct type is private in react-markdown.
    (props: any) => {
      const { children } = props;

      const firstChild = Array.isArray(children) && children.length > 0 ? children[0] : children;

      if (typeof firstChild === "string" && firstChild.startsWith('"')) {
        return <Text color="amber">{children}</Text>;
      } else {
        return <em>{children}</em>;
      }
    },
    [],
  );

  const components = useMemo(
    () => ({
      strong: NameView,
      em: DialogueView,
    }),
    [NameView, DialogueView],
  );

  return (
    <Box className="text-(length:--font-size-5) [&_p]:mb-[0.7em]" width="100%" p="6">
      <Markdown components={components}>{markdown}</Markdown>
    </Box>
  );
}
