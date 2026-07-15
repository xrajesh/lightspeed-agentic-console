import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@patternfly/react-core';

import './PreviewBadge.css';

const PreviewBadge: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  return <Label className="ols-plugin__preview-badge">{t('Dev preview')}</Label>;
};

export default PreviewBadge;
