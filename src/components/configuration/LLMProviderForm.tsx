import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextInput,
  Title,
} from '@patternfly/react-core';

import { LLMProviderType } from '../../models/agenticrun';

const PROVIDER_TYPES: { value: LLMProviderType; label: string }[] = [
  { value: 'Anthropic', label: 'Anthropic' },
  { value: 'GoogleCloudVertex', label: 'Google Cloud Vertex AI' },
  { value: 'OpenAI', label: 'OpenAI' },
  { value: 'AzureOpenAI', label: 'Azure OpenAI' },
  { value: 'AWSBedrock', label: 'AWS Bedrock' },
];

type LLMProviderFormProps = {
  onSubmit: (name: string, spec: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
};

const LLMProviderForm: React.FC<LLMProviderFormProps> = ({ onSubmit, onCancel }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');

  const [name, setName] = React.useState('');
  const [providerType, setProviderType] = React.useState<LLMProviderType>('Anthropic');
  const [secretName, setSecretName] = React.useState('');
  const [url, setUrl] = React.useState('');
  const [projectID, setProjectID] = React.useState('');
  const [region, setRegion] = React.useState('');
  const [endpoint, setEndpoint] = React.useState('');
  const [apiVersion, setApiVersion] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  const resetProviderFields = () => {
    setSecretName('');
    setUrl('');
    setProjectID('');
    setRegion('');
    setEndpoint('');
    setApiVersion('');
  };

  const buildSpec = (): Record<string, unknown> => {
    const base = { credentialsSecret: { name: secretName } };
    const withUrl = url ? { ...base, url } : base;

    switch (providerType) {
      case 'Anthropic':
        return { type: 'Anthropic', anthropic: withUrl };
      case 'GoogleCloudVertex':
        return {
          type: 'GoogleCloudVertex',
          googleCloudVertex: { ...withUrl, projectID, region },
        };
      case 'OpenAI':
        return { type: 'OpenAI', openAI: withUrl };
      case 'AzureOpenAI': {
        const cfg: Record<string, unknown> = { ...withUrl, endpoint };
        if (apiVersion) cfg.apiVersion = apiVersion;
        return { type: 'AzureOpenAI', azureOpenAI: cfg };
      }
      case 'AWSBedrock':
        return { type: 'AWSBedrock', awsBedrock: { ...withUrl, region } };
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(name, buildSpec());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  const isValid = (): boolean => {
    if (!name || !secretName) return false;
    if (providerType === 'GoogleCloudVertex' && (!projectID || !region)) return false;
    if (providerType === 'AzureOpenAI' && !endpoint) return false;
    if (providerType === 'AWSBedrock' && !region) return false;
    return true;
  };

  return (
    <div className="ols-plugin__config-form-section">
      <Title headingLevel="h3">{t('Create LLM Provider')}</Title>

      {error && <p className="ols-plugin__config-error-text">{error}</p>}

      <FormGroup label={t('Name')} isRequired fieldId="provider-name">
        <TextInput id="provider-name" value={name} onChange={(_e, v) => setName(v)} isRequired />
      </FormGroup>

      <FormGroup label={t('Provider Type')} isRequired fieldId="provider-type">
        <FormSelect
          id="provider-type"
          value={providerType}
          onChange={(_e, v) => {
            setProviderType(v as LLMProviderType);
            resetProviderFields();
          }}
        >
          {PROVIDER_TYPES.map((pt) => (
            <FormSelectOption key={pt.value} value={pt.value} label={pt.label} />
          ))}
        </FormSelect>
      </FormGroup>

      <FormGroup label={t('Credentials Secret Name')} isRequired fieldId="provider-secret">
        <TextInput
          id="provider-secret"
          value={secretName}
          onChange={(_e, v) => setSecretName(v)}
          isRequired
        />
      </FormGroup>

      {providerType === 'GoogleCloudVertex' && (
        <>
          <FormGroup label={t('Project ID')} isRequired fieldId="provider-project">
            <TextInput
              id="provider-project"
              value={projectID}
              onChange={(_e, v) => setProjectID(v)}
              isRequired
            />
          </FormGroup>
          <FormGroup label={t('Region')} isRequired fieldId="provider-region">
            <TextInput
              id="provider-region"
              value={region}
              onChange={(_e, v) => setRegion(v)}
              isRequired
            />
          </FormGroup>
        </>
      )}

      {providerType === 'AWSBedrock' && (
        <FormGroup label={t('Region')} isRequired fieldId="provider-region">
          <TextInput
            id="provider-region"
            value={region}
            onChange={(_e, v) => setRegion(v)}
            isRequired
          />
        </FormGroup>
      )}

      {providerType === 'AzureOpenAI' && (
        <>
          <FormGroup label={t('Endpoint')} isRequired fieldId="provider-endpoint">
            <TextInput
              id="provider-endpoint"
              value={endpoint}
              onChange={(_e, v) => setEndpoint(v)}
              isRequired
            />
          </FormGroup>
          <FormGroup label={t('API Version')} fieldId="provider-api-version">
            <TextInput
              id="provider-api-version"
              value={apiVersion}
              onChange={(_e, v) => setApiVersion(v)}
              placeholder="2024-02-01"
            />
          </FormGroup>
        </>
      )}

      <FormGroup label={t('URL Override')} fieldId="provider-url">
        <TextInput
          id="provider-url"
          value={url}
          onChange={(_e, v) => setUrl(v)}
          placeholder={t('Optional')}
        />
      </FormGroup>

      <div className="ols-plugin__config-form-actions">
        <Button
          variant="primary"
          onClick={handleSubmit}
          isLoading={submitting}
          isDisabled={!isValid() || submitting}
        >
          {t('Create')}
        </Button>
        <Button variant="link" onClick={onCancel} isDisabled={submitting}>
          {t('Cancel')}
        </Button>
      </div>
    </div>
  );
};

export default LLMProviderForm;
