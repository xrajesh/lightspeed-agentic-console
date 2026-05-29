import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom-v5-compat';
import {
  Breadcrumb,
  BreadcrumbItem,
  PageSection,
  Tab,
  Tabs,
  TabTitleText,
  Title,
} from '@patternfly/react-core';

import ApprovalPolicyTab from './ApprovalPolicyTab';
import LLMProvidersTab from './LLMProvidersTab';
import AgentsTab from './AgentsTab';
import './configuration.css';

const ConfigurationPage: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState<string | number>(0);

  return (
    <>
      <div className="ols-plugin__config-breadcrumb">
        <Breadcrumb>
          <BreadcrumbItem
            to="#"
            onClick={(e) => {
              e.preventDefault();
              navigate('/lightspeed/proposals');
            }}
          >
            {t('AI Hub')}
          </BreadcrumbItem>
          <BreadcrumbItem isActive>{t('Configuration')}</BreadcrumbItem>
        </Breadcrumb>
      </div>
      <PageSection>
        <Title headingLevel="h1">{t('Configuration')}</Title>
      </PageSection>
      <PageSection>
        <Tabs activeKey={activeTab} onSelect={(_e, key) => setActiveTab(key)} mountOnEnter unmountOnExit>
          <Tab eventKey={0} title={<TabTitleText>{t('Approval Policy')}</TabTitleText>}>
            <div className="ols-plugin__config-tab-content ols-plugin__config-tab-content--narrow">
              <p className="ols-plugin__config-tab-description">
                {t('Configure whether each workflow stage requires manual approval or runs automatically.')}
              </p>
              <ApprovalPolicyTab />
            </div>
          </Tab>
          <Tab eventKey={1} title={<TabTitleText>{t('LLM Providers')}</TabTitleText>}>
            <div className="ols-plugin__config-tab-content">
              <p className="ols-plugin__config-tab-description">
                {t('Large language model providers available to agents for proposal analysis and execution.')}
              </p>
              <LLMProvidersTab />
            </div>
          </Tab>
          <Tab eventKey={2} title={<TabTitleText>{t('Agents')}</TabTitleText>}>
            <div className="ols-plugin__config-tab-content">
              <p className="ols-plugin__config-tab-description">
                {t('Agent tiers define the model and settings used at each stage of a proposal workflow.')}
              </p>
              <AgentsTab />
            </div>
          </Tab>
        </Tabs>
      </PageSection>
    </>
  );
};

export default ConfigurationPage;
