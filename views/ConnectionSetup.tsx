// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025  Philipp Emanuel Weidmann <pew@worldwidemann.com>

import { Box, Code, Flex, Link, Tabs, Text, TextField, Select, Button } from "@radix-ui/themes";
import { Label } from "radix-ui";
import { GiOuroboros } from "react-icons/gi";
import { IoRefreshOutline } from "react-icons/io5";
import React, { useState } from "react";
import { useShallow } from "zustand/shallow";
import { usePluginsStateStore } from "@/app/plugins";
import WizardStep from "@/components/WizardStep";
import { useStateStore } from "@/lib/state";

const API_PRESETS = [
  { label: "Ollama", url: "http://localhost:11434/v1/" },
  { label: "LM Studio", url: "http://localhost:1234/v1/" },
  { label: "Local (llama.cpp)", url: "http://localhost:8080/v1/" },
  { label: "OpenAI", url: "https://api.openai.com/v1/" },
  { label: "Groq", url: "https://api.groq.com/openai/v1/" },
];

export default function ConnectionSetup({ onNext, onBack }: { onNext?: () => void; onBack?: () => void }) {
  const { apiUrl, apiKey, model, contextLength, activeBackend, setState } = useStateStore(
    useShallow((state) => ({
      apiUrl: state.apiUrl,
      apiKey: state.apiKey,
      model: state.model,
      contextLength: state.contextLength,
      activeBackend: state.activeBackend,
      setState: state.set,
    })),
  );

  const { backendUIs } = usePluginsStateStore(
    useShallow((state) => ({
      backendUIs: state.backendUIs,
    })),
  );

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);

  const fetchModels = async () => {
    if (!apiUrl) return;
    setIsFetching(true);
    setHasAttemptedFetch(true);
    try {
      const response = await fetch(`/api/llm?targetUrl=${encodeURIComponent(apiUrl)}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      const models = Array.isArray(data) ? data : data.data || [];
      const modelNames = models.map((m: any) => m.id || m.name || (typeof m === 'string' ? m : JSON.stringify(m)));
      setAvailableModels(modelNames);
    } catch (error) {
      console.error("Failed to fetch models:", error);
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <WizardStep title="Connection" onNext={onNext} onBack={onBack}>
      <Flex gap="6" mb="8">
        <Box flexGrow="1">
          <Tabs.Root
            value={activeBackend}
            onValueChange={(value) =>
              setState((state) => {
                state.activeBackend = value;
              })
            }
          >
            <Tabs.List>
              <Tabs.Trigger value="default">
                <Text size="6">OpenAI-compatible</Text>
              </Tabs.Trigger>
              {backendUIs.map((backendUI) => (
                <Tabs.Trigger key={backendUI.backendName} value={backendUI.backendName}>
                  <Text size="6">{backendUI.configurationTab}</Text>
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            <Box mt="5">
              <Tabs.Content value="default">
                <Box mb="5">
                  <Label.Root>
                    <Text size="6">API base URL</Text>
                  </Label.Root>
                  <Flex gap="2" mt="2" align="center">
                    <Select.Root
                      value={apiUrl}
                      onValueChange={(value) =>
                        setState((state) => {
                          state.apiUrl = value;
                        })
                      }
                    >
                      <Select.Trigger />
                      <Select.Content>
                        {API_PRESETS.map((preset) => (
                          <Select.Item key={preset.url} value={preset.url}>
                            {preset.label}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
                    <TextField.Root
                      value={apiUrl}
                      onChange={(event) =>
                        setState((state) => {
                          state.apiUrl = event.target.value;
                        })
                      }
                      className="font-mono flex-grow"
                      size="3"
                      placeholder="http://localhost:8080/v1/"
                    />
                  </Flex>
                  <Text size="4" color="gray" mt="1">
                    Usually ends with <Code size="3">/v1/</Code>
                  </Text>
                </Box>

                <Box mb="5">
                  <Label.Root>
                    <Flex width="100%" justify="between" align="end">
                      <Text size="6">API key</Text>
                      <Text size="4" color="gray">
                        Can be left empty for local servers
                      </Text>
                    </Flex>
                    <TextField.Root
                      value={apiKey}
                      onChange={(event) =>
                        setState((state) => {
                          state.apiKey = event.target.value;
                        })
                      }
                      className="mt-1 font-mono"
                      size="3"
                      placeholder="X-ABCDE-123456789"
                    />
                    <Text size="4" color="orange">
                      <strong>Note:</strong> The key is stored in the browser, not on the server where Waidrin runs.
                    </Text>
                  </Label.Root>
                </Box>

                <Box mb="5">
                  <Label.Root>
                    <Flex width="100%" justify="between" align="end">
                      <Text size="6">Model</Text>
                    </Flex>
                    <Flex gap="2" mt="2" align="center">
                      <Select.Root
                        value={model}
                        onValueChange={(value) =>
                          setState((state) => {
                            state.model = value;
                          })
                        }
                      >
                        <Select.Trigger>
                          {!hasAttemptedFetch || (hasAttemptedFetch && availableModels.length === 0) 
                            ? "No models loaded"
                            : (model || "Select model")}
                        </Select.Trigger>
                        <Select.Content>
                          {!hasAttemptedFetch ? (
                            <Select.Item value="none" disabled>Click refresh to load</Select.Item>
                          ) : availableModels.length === 0 ? (
                            <Select.Item value="none" disabled>No models found</Select.Item>
                          ) : (
                            availableModels.map((m) => (
                              <Select.Item key={m} value={m}>
                                {m}
                              </Select.Item>
                            ))
                          )}
                        </Select.Content>
                      </Select.Root>

                      <Button
                        variant="ghost"
                        size="1"
                        onClick={fetchModels}
                        disabled={isFetching || !apiUrl}
                      >
                        <IoRefreshOutline size="20" className={isFetching ? "animate-spin" : ""} />
                      </Button>

                      <TextField.Root
                        value={model}
                        onChange={(event) =>
                          setState((state) => {
                            state.model = event.target.value;
                          })
                        }
                        className="font-mono flex-grow"
                        size="3"
                        placeholder="mistral-small3.2"
                      />
                    </Flex>
                  </Label.Root>
                </Box>

                <Box mb="5">
                  <Label.Root>
                    <Flex width="100%" justify="between" align="end">
                      <Text size="6">Context length</Text>
                      <Text size="4" color="gray">
                        Check backend configuration or provider documentation for the correct value
                      </Text>
                    </Flex>
                    <TextField.Root
                      value={contextLength}
                      onChange={(event) =>
                        setState((state) => {
                          state.contextLength = Number(event.target.value);
                          if (Number.isNaN(state.contextLength)) {
                            state.contextLength = 0;
                          }

                          // Some API providers have input limits that are substantially lower
                          // than the context length. This is a pragmatic hack to address that
                          // without having to add yet another potentially confusing UI input.
                          state.inputLength = Math.min(state.contextLength, 250000);
                        })
                      }
                      className="mt-1 font-mono"
                      size="3"
                      placeholder="16384"
                    />
                  </Label.Root>
                </Box>

                <Box>
                  <Text size="5" color="amber">
                    <strong>Note:</strong> Waidrin uses constrained generation. It requires support for JSON schema
                    constraints (the <Code size="4">response_format</Code> parameter with the{" "}
                    <Code size="4">json_schema</Code> type). Backends that support JSON schemas include the{" "}
                    <Link href="https://github.com/ggml-org/llama.cpp/tree/master/tools/server">llama.cpp server</Link>,{" "}
                    <Link href="https://github.com/LostRuins/koboldcpp">KoboldCpp</Link>,{" "}
                    <Link href="https://ollama.com">Ollama</Link>, and many cloud providers. Some providers support
                    schemas only for certain models; check the provider documentation if in doubt.
                  </Text>
                </Box>
              </Tabs.Content>

              {backendUIs.map((backendUI) => (
                <Tabs.Content key={backendUI.backendName} value={backendUI.backendName}>
                  {backendUI.configurationPage}
                </Tabs.Content>
              ))}
            </Box>
          </Tabs.Root>
        </Box>

        <Box className="w-[250px]">
          <GiOuroboros className="transform scale-x-[-1] -mr-5" size="250" color="var(--amber-8)" />
        </Box>
      </Flex>
    </WizardStep>
  );
}
