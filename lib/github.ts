import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export const getFileSha = async (path: string): Promise<string | undefined> => {
  try {
    const { data } = await octokit.repos.getContent({
      owner: process.env.GITHUB_OWNER || '',
      repo: process.env.GITHUB_REPO || '',
      path,
    });

    if (Array.isArray(data)) return undefined;

    return data.sha;
  } catch (error) {
    if (error.status === 404) return undefined;
    throw error;
  }
};

export const commitFile = async (path: string, content: string, message: string): Promise<void> => {
  try {
    const sha = await getFileSha(path);
    await octokit.repos.createOrUpdateFileContents({
      owner: process.env.GITHUB_OWNER || '',
      repo: process.env.GITHUB_REPO || '',
      path,
      message,
      content: Buffer.from(content).toString('base64'),
      sha,
    });
  } catch (error) {
    throw error;
  }
};

export const createBranch = async (branchName: string): Promise<void> => {
  try {
    const { data: mainBranch } = await octokit.repos.getBranch({
      owner: process.env.GITHUB_OWNER || '',
      repo: process.env.GITHUB_REPO || '',
      branch: 'main',
    });

    await octokit.git.createRef({
      owner: process.env.GITHUB_OWNER || '',
      repo: process.env.GITHUB_REPO || '',
      ref: `refs/heads/${branchName}`,
      sha: mainBranch.commit.sha,
    });
  } catch (error) {
    throw error;
  }
};

export const createPullRequest = async (title: string, body: string, head: string, base: string = 'main'): Promise<string> => {
  try {
    const { data } = await octokit.pulls.create({
      owner: process.env.GITHUB_OWNER || '',
      repo: process.env.GITHUB_REPO || '',
      title,
      body,
      head,
      base,
    });

    return data.html_url;
  } catch (error) {
    throw error;
  }
};