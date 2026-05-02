/**
 * Feature Registry Build Script
 *
 * Reads each feature's manifest.json, inlines all referenced file contents,
 * and outputs a single JSON file per feature to dist/r/{name}.json.
 *
 * Also generates dist/r/index.json with an overview of all available features.
 *
 * Usage: npm run build
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';

const FEATURES_DIR = 'features';
const OUTPUT_DIR = 'dist/r';

// ── Types ──────────────────────────────────────────────────────────────────

interface ManifestFile {
	source: string;
	target: string;
	type: string;
	hint?: string;
}

interface Manifest {
	name: string;
	title: string;
	description: string;
	version: string;
	dependencies?: Record<string, string>;
	featureRegistryDependencies?: string[];
	requiredEnv?: string[];
	files: ManifestFile[];
	i18n?: {
		merge: boolean;
		sources: Record<string, string>;
		targetKey: string;
	};
	postInstall?: string[];
}

interface OutputFile {
	target: string;
	type: string;
	hint?: string;
	content: string;
}

interface OutputFeature {
	name: string;
	title: string;
	description: string;
	version: string;
	dependencies?: Record<string, string>;
	featureRegistryDependencies?: string[];
	requiredEnv?: string[];
	files: OutputFile[];
	i18n?: Record<string, Record<string, unknown>>;
	postInstall?: string[];
}

interface IndexEntry {
	name: string;
	title: string;
	description: string;
	version: string;
	url: string;
}

// ── Build ──────────────────────────────────────────────────────────────────

async function buildFeature(featureDir: string): Promise<OutputFeature> {
	const manifestPath = join(featureDir, 'manifest.json');
	const manifestRaw = await readFile(manifestPath, 'utf-8');
	const manifest: Manifest = JSON.parse(manifestRaw);

	console.log(`  Building: ${manifest.name} v${manifest.version}`);

	// Inline all file contents
	const files: OutputFile[] = [];
	for (const file of manifest.files) {
		const sourcePath = join(featureDir, file.source);

		if (!existsSync(sourcePath)) {
			console.warn(`    ⚠ File not found, skipping: ${file.source}`);
			continue;
		}

		const content = await readFile(sourcePath, 'utf-8');
		files.push({
			target: file.target,
			type: file.type,
			...(file.hint ? { hint: file.hint } : {}),
			content
		});
		console.log(`    ✓ ${file.source} → ${file.target}`);
	}

	// Inline i18n sources
	let i18n: Record<string, Record<string, unknown>> | undefined;
	if (manifest.i18n?.sources) {
		i18n = {};
		for (const [locale, sourcePath] of Object.entries(manifest.i18n.sources)) {
			const fullPath = join(featureDir, sourcePath);
			if (!existsSync(fullPath)) {
				console.warn(`    ⚠ i18n file not found, skipping: ${sourcePath}`);
				continue;
			}
			const content = await readFile(fullPath, 'utf-8');
			i18n[locale] = JSON.parse(content);
			console.log(`    ✓ i18n/${locale} inlined`);
		}
	}

	// Build output
	const output: OutputFeature = {
		name: manifest.name,
		title: manifest.title,
		description: manifest.description,
		version: manifest.version
	};

	if (manifest.dependencies && Object.keys(manifest.dependencies).length > 0) {
		output.dependencies = manifest.dependencies;
	}
	if (manifest.featureRegistryDependencies?.length) {
		output.featureRegistryDependencies = manifest.featureRegistryDependencies;
	}
	if (manifest.requiredEnv?.length) {
		output.requiredEnv = manifest.requiredEnv;
	}

	output.files = files;

	if (i18n && Object.keys(i18n).length > 0) {
		output.i18n = i18n;
	}
	if (manifest.postInstall?.length) {
		output.postInstall = manifest.postInstall;
	}

	return output;
}

async function build() {
	console.log('Feature Registry Build\n');

	// Ensure output directory exists
	await mkdir(OUTPUT_DIR, { recursive: true });

	// Find all feature directories
	const entries = await readdir(FEATURES_DIR, { withFileTypes: true });
	const featureDirs = entries
		.filter((e) => e.isDirectory())
		.map((e) => join(FEATURES_DIR, e.name));

	if (featureDirs.length === 0) {
		console.log('No features found.');
		return;
	}

	console.log(`Found ${featureDirs.length} feature(s):\n`);

	const index: IndexEntry[] = [];

	for (const featureDir of featureDirs) {
		try {
			const feature = await buildFeature(featureDir);

			// Write feature JSON
			const outputPath = join(OUTPUT_DIR, `${feature.name}.json`);
			await mkdir(dirname(outputPath), { recursive: true });
			await writeFile(outputPath, JSON.stringify(feature, null, 2), 'utf-8');
			console.log(`    → ${outputPath}\n`);

			index.push({
				name: feature.name,
				title: feature.title,
				description: feature.description,
				version: feature.version,
				url: `r/${feature.name}.json`
			});
		} catch (err) {
			console.error(`  ✗ Error building ${featureDir}:`, err);
		}
	}

	// Write index
	const indexPath = join(OUTPUT_DIR, 'index.json');
	await writeFile(
		indexPath,
		JSON.stringify({ features: index, generatedAt: new Date().toISOString() }, null, 2),
		'utf-8'
	);
	console.log(`Index → ${indexPath}`);
	console.log(`\nDone! ${index.length} feature(s) built.`);
}

build().catch((err) => {
	console.error('Build failed:', err);
	process.exit(1);
});
