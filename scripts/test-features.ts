/**
 * Feature Registry Integration Test
 *
 * Clones the starter-app, installs each feature from the local build output,
 * merges Prisma schemas and i18n keys, runs migrations, and type-checks.
 *
 * Usage: npm run test
 *
 * Requires:
 *   - dist/r/*.json to be built (run `npm run build` first)
 *   - PostgreSQL running on localhost:5432 (user: postgres, password: postgres)
 */

import { readdir, readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const DIST_DIR = 'dist/r';
const TEST_DIR = '.test-app';
const STARTER_REPO = 'https://github.com/hanovatech/starter-app.git';
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/feature_registry_test';

function run(cmd: string, cwd?: string) {
	console.log(`  $ ${cmd}`);
	execSync(cmd, { cwd: cwd || TEST_DIR, stdio: 'pipe', env: { ...process.env, DATABASE_URL: DB_URL } });
}

function runOutput(cmd: string, cwd?: string): string {
	return execSync(cmd, { cwd: cwd || TEST_DIR, stdio: 'pipe', env: { ...process.env, DATABASE_URL: DB_URL } }).toString();
}

// ── Feature Installation ──────────────────────────────────────────────────

interface FeatureFile {
	target: string;
	type: string;
	hint?: string;
	content: string;
}

interface Feature {
	name: string;
	version: string;
	files: FeatureFile[];
	i18n?: Record<string, Record<string, unknown>>;
	dependencies?: Record<string, string>;
}

async function installFeature(feature: Feature) {
	console.log(`\n  Installing feature: ${feature.name} v${feature.version}`);

	// 1. Write files (skip s3.ts if it already exists — starter has it)
	for (const file of feature.files) {
		const targetPath = join(TEST_DIR, file.target);

		if (existsSync(targetPath) && file.hint?.toLowerCase().includes('merge')) {
			console.log(`    SKIP (exists): ${file.target}`);
			continue;
		}

		await mkdir(join(TEST_DIR, file.target, '..'), { recursive: true });
		await writeFile(targetPath, file.content, 'utf-8');
		console.log(`    CREATE: ${file.target}`);
	}

	// 2. Merge i18n keys
	if (feature.i18n) {
		for (const [locale, keys] of Object.entries(feature.i18n)) {
			const i18nPath = join(TEST_DIR, `src/lib/i18n/${locale}.json`);
			if (!existsSync(i18nPath)) continue;

			const existing = JSON.parse(await readFile(i18nPath, 'utf-8'));
			existing[feature.name] = keys;
			await writeFile(i18nPath, JSON.stringify(existing, null, 2) + '\n', 'utf-8');
			console.log(`    MERGE: i18n/${locale}.json ← "${feature.name}" key`);
		}
	}

	// 3. Merge Prisma schema fragment
	const fragmentFile = feature.files.find((f) => f.type === 'prisma-fragment');
	if (fragmentFile) {
		await mergePrismaFragment(fragmentFile.content, feature.name);
	}

	// 4. Install npm dependencies
	if (feature.dependencies && Object.keys(feature.dependencies).length > 0) {
		const deps = Object.entries(feature.dependencies)
			.map(([name, version]) => `${name}@"${version}"`)
			.join(' ');
		console.log(`    Installing dependencies...`);
		run(`npm install ${deps} --save`);
	}
}

async function mergePrismaFragment(fragmentContent: string, featureName: string) {
	const schemaPath = join(TEST_DIR, 'prisma/schema.prisma');
	let schema = await readFile(schemaPath, 'utf-8');

	// Extract enums and models from fragment (skip comments)
	const lines = fragmentContent.split('\n');
	const blocks: string[] = [];
	let current: string[] = [];
	let inBlock = false;

	for (const line of lines) {
		if (/^(enum|model)\s+\w+/.test(line)) {
			inBlock = true;
			current = [line];
		} else if (inBlock) {
			current.push(line);
			if (line.trim() === '}') {
				blocks.push(current.join('\n'));
				inBlock = false;
				current = [];
			}
		}
	}

	// Find model name that has a User relation (to add reverse relation)
	const userRelationMatch = fragmentContent.match(/uploadedBy\s+User/);
	if (userRelationMatch) {
		// Add documents relation to User model
		schema = schema.replace(
			/(model User \{[\s\S]*?)(@@map\("users"\))/,
			`$1documents Document[]\n\n  $2`
		);
		console.log(`    MERGE: Added documents relation to User model`);
	}

	// Append feature models to schema
	const marker = '// ─── Add your domain models below';
	const featureBlock = `// ─── ${featureName.charAt(0).toUpperCase() + featureName.slice(1)} ${'─'.repeat(Math.max(0, 63 - featureName.length))}\n\n${blocks.join('\n\n')}`;

	if (schema.includes(marker)) {
		schema = schema.replace(marker, `${featureBlock}\n\n${marker}`);
	} else {
		schema += `\n\n${featureBlock}\n`;
	}

	await writeFile(schemaPath, schema, 'utf-8');
	console.log(`    MERGE: Prisma schema ← ${blocks.length} block(s)`);
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
	console.log('Feature Registry Integration Test\n');

	// 1. Check dist exists
	if (!existsSync(DIST_DIR)) {
		console.error('dist/ not found. Run `npm run build` first.');
		process.exit(1);
	}

	// 2. Clean up previous test
	if (existsSync(TEST_DIR)) {
		await rm(TEST_DIR, { recursive: true });
	}

	// 3. Clone starter-app
	console.log('Cloning starter-app...');
	execSync(`git clone --depth 1 ${STARTER_REPO} ${TEST_DIR}`, { stdio: 'pipe' });
	console.log('  Done.\n');

	// 4. Install starter dependencies
	console.log('Installing starter dependencies...');
	run('npm ci');
	console.log('  Done.');

	// 5. Read all built features
	const files = await readdir(DIST_DIR);
	const featureFiles = files.filter((f) => f !== 'index.json' && f.endsWith('.json'));

	if (featureFiles.length === 0) {
		console.log('\nNo features to test.');
		return;
	}

	console.log(`\nFound ${featureFiles.length} feature(s) to test.`);

	// 6. Install each feature
	for (const file of featureFiles) {
		const raw = await readFile(join(DIST_DIR, file), 'utf-8');
		const feature: Feature = JSON.parse(raw);
		await installFeature(feature);
	}

	// 7. Create .env for Prisma
	await writeFile(
		join(TEST_DIR, '.env'),
		[
			`DATABASE_URL="${DB_URL}"`,
			'AUTH_SECRET="test-secret"',
			'AUTH_TRUST_HOST="true"',
			'AUTH_POSTMARK_API_TOKEN="dummy"',
			'AUTH_POSTMARK_SENDER="Test <test@test.com>"',
			'S3_ENDPOINT_URL="https://placeholder"',
			'S3_REGION="eu-central-1"',
			'S3_ACCESS_KEY_ID="dummy"',
			'S3_ACCESS_KEY_SECRET="dummy"',
			'S3_BUCKET_NAME="dummy"',
			'POSTMARK_API_TOKEN="dummy"',
			'POSTMARK_SENDER="Test <test@test.com>"'
		].join('\n') + '\n',
		'utf-8'
	);

	// 8. Generate Prisma client + migrate
	console.log('\n\nRunning Prisma generate...');
	run('npx prisma generate');

	console.log('Running Prisma migrate...');
	run('npx prisma migrate dev --name test_all_features --create-only');
	run('npx prisma migrate deploy');

	// 9. Run svelte-check
	console.log('\nRunning svelte-check...');
	run('npx svelte-kit sync');
	try {
		const output = runOutput('npx svelte-check --tsconfig ./tsconfig.json');
		const match = output.match(/(\d+) ERRORS/);
		const errors = match ? parseInt(match[1]) : 0;

		if (errors > 0) {
			console.error(`\n✗ svelte-check found ${errors} error(s):\n`);
			console.error(output);
			process.exit(1);
		}

		console.log('  ✓ 0 errors');
	} catch (err) {
		const output = (err as { stdout?: Buffer }).stdout?.toString() || '';
		console.error(`\n✗ svelte-check failed:\n`);
		console.error(output);
		process.exit(1);
	}

	// 10. Cleanup
	console.log('\nCleaning up...');
	await rm(TEST_DIR, { recursive: true });

	console.log('\n✓ All features passed integration test!');
}

main().catch((err) => {
	console.error('\nTest failed:', err.message || err);
	process.exit(1);
});
