import { gatherClusterArtifacts, oc } from './fixtures';

const globalTeardown = async () => {
  if (process.env.SKIP_OLS_SETUP) {
    console.log('Skip OLS teardown because SKIP_OLS_SETUP is true');
    return;
  }

  const username = process.env.LOGIN_USERNAME || 'kubeadmin';

  console.log('Gathering cluster artifacts...');
  gatherClusterArtifacts();

  try {
    oc(['adm', 'policy', 'remove-cluster-role-from-user', 'cluster-admin', username]);
  } catch {
    // Ignore errors during cleanup
  }

  console.log('OLS cleanup complete');
};

export default globalTeardown;
