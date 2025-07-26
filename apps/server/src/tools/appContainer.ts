import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';

/**
 * Helper function to safely extract error message from unknown error
 */
function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Command result interface for Linux-like command execution
 */
export interface CommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    duration?: number;
}

/**
 * File information for directory listings
 */
export interface FileInfo {
    name: string;
    size: number;
    isDirectory: boolean;
    permissions: string;
    modified: Date;
}

/**
 * Process information for running processes
 */
export interface ProcessInfo {
    pid: number;
    name: string;
    command: string;
    startTime: Date;
    status: 'running' | 'stopped' | 'error';
}

/**
 * Command parsing result
 */
interface ParsedCommand {
    command: string;
    args: string[];
    flags: string[];
    redirect?: {
        type: '>' | '>>' | '<' | '|';
        target: string;
    };
    pipes?: string[];
}

/**
 * App Container Tool - Provides a Linux-like terminal environment for generated applications
 * 
 * This tool simulates a container environment where the coding agent can execute
 * bash commands as if working in a real Linux terminal. It supports file operations,
 * process management, and all common shell commands needed for development.
 */
export class AppContainer {
    private workDir: string;
    private processes: Map<string, ChildProcess> = new Map();
    private currentDir: string = '/app';
    private environment: Map<string, string> = new Map();
    private commandHistory: string[] = [];
    private events: EventEmitter = new EventEmitter();

    constructor(private conversationId: string) {
        // Create isolated workspace for this conversation
        this.workDir = path.join(os.tmpdir(), 'app-builder', this.conversationId);
        this.initializeEnvironment();
    }

    /**
     * Initialize the container environment
     */
    private async initializeEnvironment(): Promise<void> {
        // Ensure workspace directory exists
        await fs.mkdir(this.workDir, { recursive: true });

        // Set up default environment variables
        this.environment.set('PWD', this.currentDir);
        this.environment.set('HOME', '/app');
        this.environment.set('USER', 'developer');
        this.environment.set('SHELL', '/bin/bash');
        this.environment.set('PATH', '/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin');
        this.environment.set('NODE_ENV', 'development');

        // Create initial directory structure
        await fs.mkdir(this.toRealPath('/app'), { recursive: true });

        console.log(`🐳 Container initialized for conversation: ${this.conversationId}`);
        console.log(`📁 Workspace: ${this.workDir}`);
    }

    /**
     * Main terminal interface - executes bash commands like a real Linux terminal
     */
    async executeCommand(command: string): Promise<CommandResult> {
        const startTime = Date.now();

        try {
            // Add to command history
            this.commandHistory.push(command);

            // Parse the command
            const parsed = this.parseCommand(command.trim());

            console.log(`🔧 Executing: ${command} in ${this.currentDir}`);

            // Handle built-in commands
            let result: CommandResult;

            switch (parsed.command) {
                case 'pwd':
                    result = await this.pwd();
                    break;
                case 'cd':
                    result = await this.cd(parsed.args[0] || '/app');
                    break;
                case 'ls':
                    result = await this.ls(parsed.args, parsed.flags);
                    break;
                case 'cat':
                    result = await this.cat(parsed.args);
                    break;
                case 'echo':
                    result = await this.echo(parsed.args, parsed.redirect);
                    break;
                case 'mkdir':
                    result = await this.mkdir(parsed.args, parsed.flags);
                    break;
                case 'rm':
                    result = await this.rm(parsed.args, parsed.flags);
                    break;
                case 'cp':
                    result = await this.cp(parsed.args[0], parsed.args[1], parsed.flags);
                    break;
                case 'mv':
                    result = await this.mv(parsed.args[0], parsed.args[1]);
                    break;
                case 'touch':
                    result = await this.touch(parsed.args);
                    break;
                case 'sed':
                    result = await this.sed(parsed.args, parsed.flags);
                    break;
                case 'grep':
                    result = await this.grep(parsed.args, parsed.flags);
                    break;
                case 'find':
                    result = await this.find(parsed.args, parsed.flags);
                    break;
                case 'head':
                    result = await this.head(parsed.args, parsed.flags);
                    break;
                case 'tail':
                    result = await this.tail(parsed.args, parsed.flags);
                    break;
                case 'wc':
                    result = await this.wc(parsed.args, parsed.flags);
                    break;
                case 'env':
                    result = await this.env();
                    break;
                case 'export':
                    result = await this.export(parsed.args);
                    break;
                case 'history':
                    result = await this.history();
                    break;
                case 'ps':
                    result = await this.ps();
                    break;
                case 'kill':
                    result = await this.kill(parsed.args);
                    break;
                case 'npm':
                    result = await this.npm(parsed.args);
                    break;
                case 'node':
                    result = await this.node(parsed.args);
                    break;
                case 'npx':
                    result = await this.npx(parsed.args);
                    break;
                case 'which':
                    result = await this.which(parsed.args);
                    break;
                default:
                    // Try to execute as a system command
                    result = await this.execSystemCommand(command);
                    break;
            }

            const duration = Date.now() - startTime;
            result.duration = duration;

            console.log(`✅ Command completed in ${duration}ms (exit code: ${result.exitCode})`);

            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`❌ Command failed: ${errorMessage}`);

            return {
                stdout: '',
                stderr: `bash: ${command}: ${errorMessage}`,
                exitCode: 1,
                duration
            };
        }
    }

    /**
     * Parse a bash command into components
     */
    private parseCommand(command: string): ParsedCommand {
        // Handle simple command parsing (can be enhanced for complex cases)
        const parts = command.split(/\s+/);
        const cmd = parts[0];
        const args: string[] = [];
        const flags: string[] = [];

        for (let i = 1; i < parts.length; i++) {
            const part = parts[i];
            if (part.startsWith('-')) {
                flags.push(part);
            } else {
                args.push(part);
            }
        }

        // Handle redirections (basic support)
        let redirect;
        const redirectMatch = command.match(/(>>?|<|\|)\s*(.+)$/);
        if (redirectMatch) {
            redirect = {
                type: redirectMatch[1] as '>' | '>>' | '<' | '|',
                target: redirectMatch[2].trim()
            };
        }

        return { command: cmd, args, flags, redirect };
    }

    /**
     * Print working directory
     */
    private async pwd(): Promise<CommandResult> {
        return {
            stdout: this.currentDir,
            stderr: '',
            exitCode: 0
        };
    }

    /**
     * Change directory
     */
    private async cd(targetDir?: string): Promise<CommandResult> {
        if (!targetDir || targetDir === '~') {
            this.currentDir = '/app';
        } else {
            const newDir = this.resolvePath(targetDir);
            const realPath = this.toRealPath(newDir);

            try {
                const stats = await fs.stat(realPath);
                if (stats.isDirectory()) {
                    this.currentDir = newDir;
                    this.environment.set('PWD', this.currentDir);
                } else {
                    return {
                        stdout: '',
                        stderr: `cd: ${targetDir}: Not a directory`,
                        exitCode: 1
                    };
                }
            } catch (error) {
                return {
                    stdout: '',
                    stderr: `cd: ${targetDir}: No such file or directory`,
                    exitCode: 1
                };
            }
        }

        return {
            stdout: '',
            stderr: '',
            exitCode: 0
        };
    }

    /**
     * List directory contents
     */
    private async ls(args: string[], flags: string[]): Promise<CommandResult> {
        const targetPath = this.resolvePath(args[0] || '.');
        const realPath = this.toRealPath(targetPath);

        try {
            const files = await fs.readdir(realPath);

            if (flags.includes('-l')) {
                // Long format
                const details = await Promise.all(files.map(async (file) => {
                    const filePath = path.join(realPath, file);
                    const stats = await fs.stat(filePath);
                    return this.formatLsLine(file, stats);
                }));
                return {
                    stdout: details.join('\n'),
                    stderr: '',
                    exitCode: 0
                };
            } else {
                // Simple format
                const output = flags.includes('-a')
                    ? ['.', '..', ...files].join('  ')
                    : files.join('  ');

                return {
                    stdout: output,
                    stderr: '',
                    exitCode: 0
                };
            }
        } catch (error) {
            return {
                stdout: '',
                stderr: `ls: ${args[0] || '.'}: No such file or directory`,
                exitCode: 1
            };
        }
    }

    /**
     * Format a single line for ls -l output
     */
    private formatLsLine(filename: string, stats: any): string {
        const permissions = this.formatPermissions(stats.mode);
        const size = stats.size.toString().padStart(8);
        const date = stats.mtime.toISOString().slice(0, 16).replace('T', ' ');
        return `${permissions} 1 developer developer ${size} ${date} ${filename}`;
    }

    /**
     * Format file permissions for ls -l
     */
    private formatPermissions(mode: number): string {
        const type = (mode & 0o170000) === 0o040000 ? 'd' : '-';
        const owner = [
            (mode & 0o400) ? 'r' : '-',
            (mode & 0o200) ? 'w' : '-',
            (mode & 0o100) ? 'x' : '-'
        ].join('');
        const group = [
            (mode & 0o040) ? 'r' : '-',
            (mode & 0o020) ? 'w' : '-',
            (mode & 0o010) ? 'x' : '-'
        ].join('');
        const other = [
            (mode & 0o004) ? 'r' : '-',
            (mode & 0o002) ? 'w' : '-',
            (mode & 0o001) ? 'x' : '-'
        ].join('');

        return type + owner + group + other;
    }

    /**
     * Display file contents
     */
    private async cat(files: string[]): Promise<CommandResult> {
        if (files.length === 0) {
            return {
                stdout: '',
                stderr: 'cat: missing file operand',
                exitCode: 1
            };
        }

        try {
            const contents = await Promise.all(
                files.map(file => {
                    const realPath = this.toRealPath(this.resolvePath(file));
                    return fs.readFile(realPath, 'utf-8');
                })
            );

            return {
                stdout: contents.join('\n'),
                stderr: '',
                exitCode: 0
            };
        } catch (error) {
            return {
                stdout: '',
                stderr: `cat: ${getErrorMessage(error)}`,
                exitCode: 1
            };
        }
    }

    /**
     * Echo text or write to file
     */
    private async echo(args: string[], redirect?: ParsedCommand['redirect']): Promise<CommandResult> {
        const text = args.join(' ');

        if (redirect) {
            const targetFile = this.toRealPath(this.resolvePath(redirect.target));

            try {
                if (redirect.type === '>') {
                    await fs.writeFile(targetFile, text + '\n');
                } else if (redirect.type === '>>') {
                    await fs.appendFile(targetFile, text + '\n');
                }

                return {
                    stdout: '',
                    stderr: '',
                    exitCode: 0
                };
            } catch (error) {
                return {
                    stdout: '',
                    stderr: `echo: ${getErrorMessage(error)}`,
                    exitCode: 1
                };
            }
        } else {
            return {
                stdout: text,
                stderr: '',
                exitCode: 0
            };
        }
    }

    /**
     * Create directories
     */
    private async mkdir(args: string[], flags: string[]): Promise<CommandResult> {
        if (args.length === 0) {
            return {
                stdout: '',
                stderr: 'mkdir: missing operand',
                exitCode: 1
            };
        }

        const recursive = flags.includes('-p');

        try {
            for (const dir of args) {
                const realPath = this.toRealPath(this.resolvePath(dir));
                await fs.mkdir(realPath, { recursive });
            }

            return {
                stdout: '',
                stderr: '',
                exitCode: 0
            };
        } catch (error) {
            return {
                stdout: '',
                stderr: `mkdir: ${getErrorMessage(error)}`,
                exitCode: 1
            };
        }
    }

    /**
     * Remove files and directories
     */
    private async rm(args: string[], flags: string[]): Promise<CommandResult> {
        if (args.length === 0) {
            return {
                stdout: '',
                stderr: 'rm: missing operand',
                exitCode: 1
            };
        }

        const recursive = flags.includes('-r') || flags.includes('-rf');
        const force = flags.includes('-f') || flags.includes('-rf');

        try {
            for (const file of args) {
                const realPath = this.toRealPath(this.resolvePath(file));

                try {
                    const stats = await fs.stat(realPath);
                    if (stats.isDirectory() && recursive) {
                        await fs.rm(realPath, { recursive: true, force });
                    } else if (stats.isFile()) {
                        await fs.unlink(realPath);
                    } else if (stats.isDirectory() && !recursive) {
                        return {
                            stdout: '',
                            stderr: `rm: ${file}: is a directory`,
                            exitCode: 1
                        };
                    }
                } catch (error) {
                    if (!force) {
                        return {
                            stdout: '',
                            stderr: `rm: ${file}: No such file or directory`,
                            exitCode: 1
                        };
                    }
                }
            }

            return {
                stdout: '',
                stderr: '',
                exitCode: 0
            };
        } catch (error) {
            return {
                stdout: '',
                stderr: `rm: ${getErrorMessage(error)}`,
                exitCode: 1
            };
        }
    }

    /**
     * Copy files
     */
    private async cp(source: string, dest: string, flags: string[]): Promise<CommandResult> {
        if (!source || !dest) {
            return {
                stdout: '',
                stderr: 'cp: missing file operand',
                exitCode: 1
            };
        }

        const recursive = flags.includes('-r');
        const sourcePath = this.toRealPath(this.resolvePath(source));
        const destPath = this.toRealPath(this.resolvePath(dest));

        try {
            const sourceStats = await fs.stat(sourcePath);

            if (sourceStats.isDirectory() && !recursive) {
                return {
                    stdout: '',
                    stderr: `cp: ${source}: is a directory (not copied)`,
                    exitCode: 1
                };
            }

            if (sourceStats.isDirectory() && recursive) {
                await this.copyDirectory(sourcePath, destPath);
            } else {
                await fs.copyFile(sourcePath, destPath);
            }

            return {
                stdout: '',
                stderr: '',
                exitCode: 0
            };
        } catch (error) {
            return {
                stdout: '',
                stderr: `cp: ${getErrorMessage(error)}`,
                exitCode: 1
            };
        }
    }

    /**
     * Move/rename files
     */
    private async mv(source: string, dest: string): Promise<CommandResult> {
        if (!source || !dest) {
            return {
                stdout: '',
                stderr: 'mv: missing file operand',
                exitCode: 1
            };
        }

        const sourcePath = this.toRealPath(this.resolvePath(source));
        const destPath = this.toRealPath(this.resolvePath(dest));

        try {
            await fs.rename(sourcePath, destPath);

            return {
                stdout: '',
                stderr: '',
                exitCode: 0
            };
        } catch (error) {
            return {
                stdout: '',
                stderr: `mv: ${getErrorMessage(error)}`,
                exitCode: 1
            };
        }
    }

    /**
     * Create empty files or update timestamps
     */
    private async touch(files: string[]): Promise<CommandResult> {
        if (files.length === 0) {
            return {
                stdout: '',
                stderr: 'touch: missing file operand',
                exitCode: 1
            };
        }

        try {
            for (const file of files) {
                const realPath = this.toRealPath(this.resolvePath(file));

                try {
                    // Update timestamp if file exists
                    const now = new Date();
                    await fs.utimes(realPath, now, now);
                } catch (error) {
                    // Create file if it doesn't exist
                    await fs.writeFile(realPath, '');
                }
            }

            return {
                stdout: '',
                stderr: '',
                exitCode: 0
            };
        } catch (error) {
            return {
                stdout: '',
                stderr: `touch: ${getErrorMessage(error)}`,
                exitCode: 1
            };
        }
    }

    /**
     * Stream editor (sed) - supports basic find/replace operations
     */
    private async sed(args: string[], flags: string[]): Promise<CommandResult> {
        if (args.length < 2) {
            return {
                stdout: '',
                stderr: 'sed: missing operand',
                exitCode: 1
            };
        }

        const inPlace = flags.includes('-i');
        const pattern = args[0];
        const files = args.slice(1);

        // Parse sed pattern (e.g., s/search/replace/g)
        const match = pattern.match(/^s\/(.+?)\/(.+?)\/(g?)$/);
        if (!match) {
            return {
                stdout: '',
                stderr: 'sed: invalid command',
                exitCode: 1
            };
        }

        const [, search, replace, global] = match;
        const regex = new RegExp(search, global ? 'g' : '');

        try {
            let output = '';

            for (const file of files) {
                const realPath = this.toRealPath(this.resolvePath(file));
                const content = await fs.readFile(realPath, 'utf-8');
                const modified = content.replace(regex, replace);

                if (inPlace) {
                    await fs.writeFile(realPath, modified);
                } else {
                    output += modified;
                }
            }

            return {
                stdout: output,
                stderr: '',
                exitCode: 0
            };
        } catch (error) {
            return {
                stdout: '',
                stderr: `sed: ${getErrorMessage(error)}`,
                exitCode: 1
            };
        }
    }

    /**
     * Search text patterns in files
     */
    private async grep(args: string[], flags: string[]): Promise<CommandResult> {
        if (args.length < 1) {
            return {
                stdout: '',
                stderr: 'grep: missing operand',
                exitCode: 1
            };
        }

        const pattern = args[0];
        const files = args.slice(1);
        const recursive = flags.includes('-r');
        const lineNumbers = flags.includes('-n');
        const ignoreCase = flags.includes('-i');

        try {
            let output = '';
            let matchFound = false;

            const regex = new RegExp(pattern, ignoreCase ? 'gi' : 'g');

            for (const file of files) {
                const realPath = this.toRealPath(this.resolvePath(file));
                const content = await fs.readFile(realPath, 'utf-8');
                const lines = content.split('\n');

                lines.forEach((line, index) => {
                    if (regex.test(line)) {
                        matchFound = true;
                        const lineOutput = lineNumbers ? `${index + 1}:${line}` : line;
                        output += files.length > 1 ? `${file}:${lineOutput}\n` : `${lineOutput}\n`;
                    }
                });
            }

            return {
                stdout: output.trim(),
                stderr: '',
                exitCode: matchFound ? 0 : 1
            };
        } catch (error) {
            return {
                stdout: '',
                stderr: `grep: ${getErrorMessage(error)}`,
                exitCode: 1
            };
        }
    }

    /**
     * Find files and directories
     */
    private async find(args: string[], flags: string[]): Promise<CommandResult> {
        const startPath = args[0] || '.';
        const realStartPath = this.toRealPath(this.resolvePath(startPath));

        try {
            const results: string[] = [];
            await this.findRecursive(realStartPath, this.resolvePath(startPath), results);

            return {
                stdout: results.join('\n'),
                stderr: '',
                exitCode: 0
            };
        } catch (error) {
            return {
                stdout: '',
                stderr: `find: ${getErrorMessage(error)}`,
                exitCode: 1
            };
        }
    }

    /**
     * Show first lines of files
     */
    private async head(args: string[], flags: string[]): Promise<CommandResult> {
        const lines = flags.includes('-n') ? parseInt(flags[flags.indexOf('-n') + 1]) || 10 : 10;
        const files = args.filter(arg => !arg.startsWith('-') && !arg.match(/^\d+$/));

        if (files.length === 0) {
            return {
                stdout: '',
                stderr: 'head: missing file operand',
                exitCode: 1
            };
        }

        try {
            let output = '';

            for (const file of files) {
                const realPath = this.toRealPath(this.resolvePath(file));
                const content = await fs.readFile(realPath, 'utf-8');
                const fileLines = content.split('\n').slice(0, lines);

                if (files.length > 1) {
                    output += `==> ${file} <==\n`;
                }
                output += fileLines.join('\n') + '\n';
            }

            return {
                stdout: output.trim(),
                stderr: '',
                exitCode: 0
            };
        } catch (error) {
            return {
                stdout: '',
                stderr: `head: ${getErrorMessage(error)}`,
                exitCode: 1
            };
        }
    }

    /**
     * Show last lines of files
     */
    private async tail(args: string[], flags: string[]): Promise<CommandResult> {
        const lines = flags.includes('-n') ? parseInt(flags[flags.indexOf('-n') + 1]) || 10 : 10;
        const files = args.filter(arg => !arg.startsWith('-') && !arg.match(/^\d+$/));

        if (files.length === 0) {
            return {
                stdout: '',
                stderr: 'tail: missing file operand',
                exitCode: 1
            };
        }

        try {
            let output = '';

            for (const file of files) {
                const realPath = this.toRealPath(this.resolvePath(file));
                const content = await fs.readFile(realPath, 'utf-8');
                const fileLines = content.split('\n').slice(-lines);

                if (files.length > 1) {
                    output += `==> ${file} <==\n`;
                }
                output += fileLines.join('\n') + '\n';
            }

            return {
                stdout: output.trim(),
                stderr: '',
                exitCode: 0
            };
        } catch (error) {
            return {
                stdout: '',
                stderr: `tail: ${getErrorMessage(error)}`,
                exitCode: 1
            };
        }
    }

    /**
     * Word, line, character, and byte count
     */
    private async wc(args: string[], flags: string[]): Promise<CommandResult> {
        const files = args.filter(arg => !arg.startsWith('-'));

        if (files.length === 0) {
            return {
                stdout: '',
                stderr: 'wc: missing file operand',
                exitCode: 1
            };
        }

        try {
            let output = '';
            let totalLines = 0, totalWords = 0, totalChars = 0;

            for (const file of files) {
                const realPath = this.toRealPath(this.resolvePath(file));
                const content = await fs.readFile(realPath, 'utf-8');

                const lines = content.split('\n').length - 1;
                const words = content.trim().split(/\s+/).length;
                const chars = content.length;

                totalLines += lines;
                totalWords += words;
                totalChars += chars;

                output += `${lines.toString().padStart(8)} ${words.toString().padStart(8)} ${chars.toString().padStart(8)} ${file}\n`;
            }

            if (files.length > 1) {
                output += `${totalLines.toString().padStart(8)} ${totalWords.toString().padStart(8)} ${totalChars.toString().padStart(8)} total\n`;
            }

            return {
                stdout: output.trim(),
                stderr: '',
                exitCode: 0
            };
        } catch (error) {
            return {
                stdout: '',
                stderr: `wc: ${getErrorMessage(error)}`,
                exitCode: 1
            };
        }
    }

    /**
     * Display environment variables
     */
    private async env(): Promise<CommandResult> {
        const output = Array.from(this.environment.entries())
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        return {
            stdout: output,
            stderr: '',
            exitCode: 0
        };
    }

    /**
     * Set environment variables
     */
    private async export(args: string[]): Promise<CommandResult> {
        if (args.length === 0) {
            return this.env();
        }

        for (const arg of args) {
            const [key, value] = arg.split('=');
            if (key && value !== undefined) {
                this.environment.set(key, value);
            }
        }

        return {
            stdout: '',
            stderr: '',
            exitCode: 0
        };
    }

    /**
     * Show command history
     */
    private async history(): Promise<CommandResult> {
        const output = this.commandHistory
            .map((cmd, index) => `${(index + 1).toString().padStart(4)} ${cmd}`)
            .join('\n');

        return {
            stdout: output,
            stderr: '',
            exitCode: 0
        };
    }

    /**
     * List running processes
     */
    private async ps(): Promise<CommandResult> {
        const output = ['  PID TTY          TIME CMD'];

        for (const [name, process] of this.processes) {
            const pid = process.pid?.toString().padStart(5) || 'N/A';
            output.push(`${pid} pts/0    00:00:00 ${name}`);
        }

        return {
            stdout: output.join('\n'),
            stderr: '',
            exitCode: 0
        };
    }

    /**
     * Kill processes
     */
    private async kill(args: string[]): Promise<CommandResult> {
        if (args.length === 0) {
            return {
                stdout: '',
                stderr: 'kill: missing operand',
                exitCode: 1
            };
        }

        for (const arg of args) {
            // Try to find process by name or PID
            let killed = false;

            for (const [name, process] of this.processes) {
                if (name === arg || process.pid?.toString() === arg) {
                    process.kill();
                    this.processes.delete(name);
                    killed = true;
                    break;
                }
            }

            if (!killed) {
                return {
                    stdout: '',
                    stderr: `kill: ${arg}: No such process`,
                    exitCode: 1
                };
            }
        }

        return {
            stdout: '',
            stderr: '',
            exitCode: 0
        };
    }

    /**
     * Execute npm commands
     */
    private async npm(args: string[]): Promise<CommandResult> {
        const subcommand = args[0];
        const realPath = this.toRealPath(this.currentDir);

        return new Promise((resolve) => {
            const npm = spawn('npm', args, {
                cwd: realPath,
                shell: true,
                env: { ...process.env, ...Object.fromEntries(this.environment) }
            });

            let stdout = '';
            let stderr = '';

            npm.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            npm.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            npm.on('close', (code) => {
                resolve({ stdout, stderr, exitCode: code || 0 });
            });

            npm.on('error', (error) => {
                resolve({
                    stdout: '',
                    stderr: `npm: ${error.message}`,
                    exitCode: 1
                });
            });

            // Store long-running processes
            if (subcommand === 'run' && (args[1] === 'dev' || args[1] === 'start')) {
                this.processes.set(`npm-${args[1]}`, npm);
            }
        });
    }

    /**
     * Execute node commands
     */
    private async node(args: string[]): Promise<CommandResult> {
        const realPath = this.toRealPath(this.currentDir);

        return new Promise((resolve) => {
            const node = spawn('node', args, {
                cwd: realPath,
                shell: true,
                env: { ...process.env, ...Object.fromEntries(this.environment) }
            });

            let stdout = '';
            let stderr = '';

            node.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            node.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            node.on('close', (code) => {
                resolve({ stdout, stderr, exitCode: code || 0 });
            });

            node.on('error', (error) => {
                resolve({
                    stdout: '',
                    stderr: `node: ${error.message}`,
                    exitCode: 1
                });
            });
        });
    }

    /**
     * Execute npx commands
     */
    private async npx(args: string[]): Promise<CommandResult> {
        const realPath = this.toRealPath(this.currentDir);

        return new Promise((resolve) => {
            const npx = spawn('npx', args, {
                cwd: realPath,
                shell: true,
                env: { ...process.env, ...Object.fromEntries(this.environment) }
            });

            let stdout = '';
            let stderr = '';

            npx.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            npx.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            npx.on('close', (code) => {
                resolve({ stdout, stderr, exitCode: code || 0 });
            });

            npx.on('error', (error) => {
                resolve({
                    stdout: '',
                    stderr: `npx: ${error.message}`,
                    exitCode: 1
                });
            });
        });
    }

    /**
     * Find command location
     */
    private async which(args: string[]): Promise<CommandResult> {
        if (args.length === 0) {
            return {
                stdout: '',
                stderr: 'which: missing operand',
                exitCode: 1
            };
        }

        const builtins = ['pwd', 'cd', 'ls', 'cat', 'echo', 'mkdir', 'rm', 'cp', 'mv', 'touch', 'sed', 'grep', 'find', 'head', 'tail', 'wc', 'env', 'export', 'history', 'ps', 'kill'];
        const command = args[0];

        if (builtins.includes(command)) {
            return {
                stdout: `builtin ${command}`,
                stderr: '',
                exitCode: 0
            };
        }

        // Check system PATH
        return new Promise((resolve) => {
            const which = spawn('which', [command], { shell: true });

            let stdout = '';
            let stderr = '';

            which.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            which.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            which.on('close', (code) => {
                resolve({ stdout: stdout.trim(), stderr, exitCode: code || 0 });
            });
        });
    }

    /**
     * Execute system commands (fallback)
     */
    private async execSystemCommand(command: string): Promise<CommandResult> {
        const realPath = this.toRealPath(this.currentDir);

        return new Promise((resolve) => {
            const child = spawn(command, [], {
                cwd: realPath,
                shell: true,
                env: { ...process.env, ...Object.fromEntries(this.environment) }
            });

            let stdout = '';
            let stderr = '';

            child.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                resolve({ stdout, stderr, exitCode: code || 0 });
            });

            child.on('error', (error) => {
                resolve({
                    stdout: '',
                    stderr: `bash: ${command}: command not found`,
                    exitCode: 127
                });
            });
        });
    }

    /**
     * Helper: Resolve relative paths to absolute virtual paths
     */
    private resolvePath(inputPath: string): string {
        if (inputPath.startsWith('/')) {
            return inputPath;
        }
        if (inputPath === '.') {
            return this.currentDir;
        }
        if (inputPath === '..') {
            const parts = this.currentDir.split('/').filter(p => p);
            parts.pop();
            return '/' + parts.join('/') || '/app';
        }
        if (inputPath.startsWith('./')) {
            inputPath = inputPath.slice(2);
        }
        if (inputPath.startsWith('../')) {
            const parts = this.currentDir.split('/').filter(p => p);
            const pathParts = inputPath.split('/');

            for (const part of pathParts) {
                if (part === '..') {
                    parts.pop();
                } else if (part !== '.' && part !== '') {
                    parts.push(part);
                }
            }

            return '/' + parts.join('/') || '/app';
        }

        return path.posix.join(this.currentDir, inputPath).replace(/\/+/g, '/');
    }

    /**
     * Helper: Convert virtual path to real filesystem path
     */
    private toRealPath(virtualPath: string): string {
        // Remove leading slash and join with workspace
        const relativePath = virtualPath.startsWith('/') ? virtualPath.slice(1) : virtualPath;
        return path.join(this.workDir, relativePath);
    }

    /**
     * Helper: Recursively copy directory
     */
    private async copyDirectory(source: string, dest: string): Promise<void> {
        await fs.mkdir(dest, { recursive: true });
        const entries = await fs.readdir(source, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(source, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                await this.copyDirectory(srcPath, destPath);
            } else {
                await fs.copyFile(srcPath, destPath);
            }
        }
    }

    /**
     * Helper: Recursively find files
     */
    private async findRecursive(realPath: string, virtualPath: string, results: string[]): Promise<void> {
        try {
            const entries = await fs.readdir(realPath, { withFileTypes: true });

            for (const entry of entries) {
                const entryVirtualPath = path.posix.join(virtualPath, entry.name);
                const entryRealPath = path.join(realPath, entry.name);

                results.push(entryVirtualPath);

                if (entry.isDirectory()) {
                    await this.findRecursive(entryRealPath, entryVirtualPath, results);
                }
            }
        } catch (error) {
            // Skip inaccessible directories
        }
    }

    /**
     * Get process information
     */
    getProcessInfo(name: string): ProcessInfo | null {
        const process = this.processes.get(name);
        if (!process) return null;

        return {
            pid: process.pid || 0,
            name,
            command: process.spawnargs?.join(' ') || '',
            startTime: new Date(), // Would need to track this properly
            status: process.killed ? 'stopped' : 'running'
        };
    }

    /**
     * Get all running processes
     */
    getAllProcesses(): ProcessInfo[] {
        return Array.from(this.processes.entries()).map(([name, process]) => ({
            pid: process.pid || 0,
            name,
            command: process.spawnargs?.join(' ') || '',
            startTime: new Date(), // Would need to track this properly
            status: process.killed ? 'stopped' : 'running'
        }));
    }

    /**
     * Cleanup container resources
     */
    async cleanup(delay: number = 5 * 60 * 1000): Promise<void> {
        // Kill all running processes
        for (const [name, process] of this.processes) {
            try {
                process.kill();
            } catch (error) {
                console.warn(`Failed to kill process ${name}:`, getErrorMessage(error));
            }
        }
        this.processes.clear();

        // Schedule workspace cleanup
        setTimeout(async () => {
            try {
                await fs.rm(this.workDir, { recursive: true, force: true });
                console.log(`🗑️ Cleaned up workspace: ${this.workDir}`);
            } catch (error) {
                console.warn(`Failed to cleanup workspace:`, getErrorMessage(error));
            }
        }, delay);

        console.log(`🐳 Container cleanup scheduled for conversation: ${this.conversationId}`);
    }
}
