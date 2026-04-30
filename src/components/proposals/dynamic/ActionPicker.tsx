import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  CardBody,
  CardTitle,
  Label,
  Split,
  SplitItem,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { getRiskColor } from '../../../models/proposal';
import type { ActionPickerProps } from './types';

export const ActionPicker: React.FC<{
  data: ActionPickerProps;
  onAction?: (_action: string, _data: Record<string, unknown>) => void;
}> = ({ data, onAction }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const [selected, setSelected] = React.useState<string | null>(null);

  return (
    <Card isCompact>
      <CardTitle>{data.title}</CardTitle>
      <CardBody>
        {data.description && (
          <p className="ols-plugin__chat-action-description">{data.description}</p>
        )}
        <Stack hasGutter>
          {data.options.map((opt) => (
            <StackItem key={opt.id}>
              <div
                className={`ols-plugin__chat-action-option ${selected === opt.id ? 'ols-plugin__chat-action-option--selected' : ''}`}
                onClick={() => setSelected(opt.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setSelected(opt.id);
                }}
                role="button"
                tabIndex={0}
              >
                <Split>
                  <SplitItem isFilled>
                    <strong>{opt.label}</strong>
                    <div className="ols-plugin__chat-action-option-desc">{opt.description}</div>
                  </SplitItem>
                  {opt.risk && (
                    <SplitItem>
                      <Label color={getRiskColor(opt.risk)} isCompact>
                        {t('{{risk}} risk', { risk: opt.risk })}
                      </Label>
                    </SplitItem>
                  )}
                </Split>
              </div>
            </StackItem>
          ))}
          {selected && onAction && (
            <StackItem>
              <Button
                onClick={() => {
                  const opt = data.options.find((o) => o.id === selected);
                  if (opt)
                    onAction('action_selected', {
                      optionId: opt.id,
                      label: opt.label,
                      message: `I'd like to go with: ${opt.label} — ${opt.description}`,
                    });
                }}
                variant="primary"
              >
                {t('Select this approach')}
              </Button>
            </StackItem>
          )}
        </Stack>
      </CardBody>
    </Card>
  );
};
