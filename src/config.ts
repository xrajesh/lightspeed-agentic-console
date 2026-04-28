const API_BASE_URL = '/api/proxy/plugin/lightspeed-agentic-console-plugin/ols';

export const getApiUrl = (path: string): string => `${API_BASE_URL}${path}`;

// Agent chat endpoint via Kubernetes API pod proxy (https: prefix because agent uses TLS)
const AGENT_NS = 'openshift-lightspeed';
const AGENT_POD = 'lightspeed-chat';
export const AGENT_CHAT_URL = `/api/kubernetes/api/v1/namespaces/${AGENT_NS}/pods/https:${AGENT_POD}:8080/proxy/chat`;

export function buildChatUrl(podName: string, podNamespace: string): string {
  return (
    `/api/kubernetes/api/v1/namespaces/${encodeURIComponent(podNamespace)}` +
    `/pods/https:${encodeURIComponent(podName)}:8080/proxy/chat`
  );
}
