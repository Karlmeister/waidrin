// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025  Philipp Emanuel Weidmann <pew@worldwidemann.com>

import { Flex, RadioCards, Text } from "@radix-ui/themes";
import type React from "react";
import { sanitizeImageUrlSegment } from "@/lib/sanitize";

export default function ImageOption({
  title,
  description,
  image,
  value,
  disabled,
}: {
  title: string;
  description?: string;
  image: string;
  value: string;
  disabled?: boolean;
}) {
  const safeImage = sanitizeImageUrlSegment(image);

  return (
    <RadioCards.Item
      className="flex items-end h-128 w-77 bg-(image:--image) bg-cover p-0"
      style={{ "--image": `url(/images/${safeImage}.png)` } as React.CSSProperties}
      value={value}
      disabled={disabled}
    >
      <Flex className="p-5 bg-[#0009]" direction="column" width="100%">
        <Text size="7" weight="bold">
          {title}
        </Text>
        {description && <Text size="6">{description}</Text>}
      </Flex>
    </RadioCards.Item>
  );
}
