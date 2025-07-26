import { AppContainer } from '../dist/src/tools/appContainer.js';

describe('App Container Tool', () => {
  let container;

  beforeEach(() => {
    // Create a new container for each test
    container = new AppContainer(`test-${Date.now()}`);
  });

  afterEach(async () => {
    // Cleanup after each test
    if (container) {
      await container.cleanup(100); // Short delay for tests
    }
  });

  test('should initialize and create React app boilerplate', async () => {
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test that basic directory structure exists
    const lsResult = await container.executeCommand('ls -la');
    expect(lsResult.exitCode).toBe(0);
    expect(lsResult.stdout).toContain('package.json');
    expect(lsResult.stdout).toContain('src');
  });

  test('should execute basic shell commands', async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test pwd
    const pwdResult = await container.executeCommand('pwd');
    expect(pwdResult.exitCode).toBe(0);
    expect(pwdResult.stdout.trim()).toBe('/app');

    // Test ls
    const lsResult = await container.executeCommand('ls');
    expect(lsResult.exitCode).toBe(0);
    expect(lsResult.stdout).toContain('package.json');
  });

  test('should handle file operations', async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create file
    const touchResult = await container.executeCommand('touch test-file.txt');
    expect(touchResult.exitCode).toBe(0);

    // Verify file exists
    const lsResult = await container.executeCommand('ls test-file.txt');
    expect(lsResult.stdout).toContain('test-file.txt');

    // Test echo
    const echoResult = await container.executeCommand('echo Hello World');
    expect(echoResult.exitCode).toBe(0);
    expect(echoResult.stdout.trim()).toBe('Hello World');
  });

  test('should handle directory navigation', async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create directory
    const mkdirResult = await container.executeCommand('mkdir -p test/nested');
    expect(mkdirResult.exitCode).toBe(0);

    // Change directory
    const cdResult = await container.executeCommand('cd test');
    expect(cdResult.exitCode).toBe(0);

    // Verify current directory
    const pwdResult = await container.executeCommand('pwd');
    expect(pwdResult.stdout.trim()).toBe('/app/test');
  });

  test('should validate React app structure', async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check package.json contains React
    const packageResult = await container.executeCommand('cat package.json');
    expect(packageResult.exitCode).toBe(0);
    expect(packageResult.stdout).toContain('react');

    // Check main files exist using test command
    const files = ['src/App.tsx', 'src/main.tsx', 'index.html', 'vite.config.ts'];
    for (const file of files) {
      const result = await container.executeCommand(`test -f ${file} && echo exists || echo missing`);
      expect(result.stdout).toContain('exists');
    }
  });

  test('should handle environment variables', async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Set environment variable
    const exportResult = await container.executeCommand('export TEST_VAR=hello');
    expect(exportResult.exitCode).toBe(0);

    // Check environment variable
    const envResult = await container.executeCommand('env');
    expect(envResult.stdout).toContain('TEST_VAR=hello');
  });

  test('should execute file utilities', async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test wc command
    const wcResult = await container.executeCommand('wc package.json');
    expect(wcResult.exitCode).toBe(0);
    expect(wcResult.stdout).toMatch(/\d+\s+\d+\s+\d+\s+package\.json/);

    // Test head command
    const headResult = await container.executeCommand('head -n 5 package.json');
    expect(headResult.exitCode).toBe(0);

    // Test which command
    const whichResult = await container.executeCommand('which npm');
    expect(whichResult.exitCode).toBe(0);
  });

  test('should handle complex directory operations', async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create nested structure
    await container.executeCommand('mkdir -p deep/nested/structure');
    await container.executeCommand('touch deep/nested/structure/file.txt');

    // Test find command
    const findResult = await container.executeCommand('find . -name "*.txt"');
    expect(findResult.exitCode).toBe(0);

    // Test copy command
    const cpResult = await container.executeCommand('cp -r deep backup');
    expect(cpResult.exitCode).toBe(0);

    // Verify copy worked
    const lsResult = await container.executeCommand('ls backup/nested/structure');
    expect(lsResult.stdout).toContain('file.txt');
  });
});
