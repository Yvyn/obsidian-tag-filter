import { App, Plugin, PluginSettingTab, Setting, TFile, Notice } from 'obsidian';

interface TagFilterState {
	tag: string;
	mode: 'include' | 'exclude';
}

interface TagFilterPluginSettings {
	showTagCount: boolean;
	sortTagsAlphabetically: boolean;
}

const DEFAULT_SETTINGS: TagFilterPluginSettings = {
	showTagCount: true,
	sortTagsAlphabetically: true,
};

export default class TagFilterPlugin extends Plugin {
	settings!: TagFilterPluginSettings;
	private activeFilters: TagFilterState[] = [];
	private tagBarEl: HTMLElement | null = null;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new TagFilterSettingTab(this.app, this));

		this.addCommand({
			id: 'toggle-tag-bar',
			name: 'Toggle Tag Filter Bar',
			callback: () => this.toggleTagBar(),
		});

		this.registerEvent(
			this.app.metadataCache.on('changed', (file) => {
				if (file instanceof TFile) this.refreshTagBar();
			})
		);

		this.registerEvent(
			this.app.vault.on('create', async (file) => {
				if (file instanceof TFile) {
					await this.addTagsToNewFile(file);
					this.refreshTagBar();
				}
			})
		);

		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (file instanceof TFile) this.refreshTagBar();
			})
		);

		this.registerEvent(
			this.app.vault.on('rename', (file) => {
				if (file instanceof TFile) this.refreshTagBar();
			})
		);

		this.app.workspace.onLayoutReady(() => {
			this.injectTagBar();
		});
	}

	onunload() {
		this.tagBarEl?.remove();
	}

	private async addTagsToNewFile(file: TFile) {
		if (this.activeFilters.length === 0) return;

		const includeTags = this.activeFilters
			.filter(f => f.mode === 'include')
			.map(f => `#${f.tag}`);

		if (includeTags.length === 0) return;

		const content = await this.app.vault.read(file);
		await this.app.vault.modify(file, includeTags.join(' ') + '\n\n' + content);
		new Notice(`Added tags: ${includeTags.join(', ')}`);
	}

	public getActiveFilters(): TagFilterState[] {
		return this.activeFilters;
	}

	public setActiveFilters(filters: TagFilterState[]) {
		this.activeFilters = filters;
		this.applyToFileExplorer();
		this.refreshTagBar();
	}

	private injectTagBar() {
		const fileExplorerLeaf = this.app.workspace.getLeavesOfType('file-explorer')[0];
		if (!fileExplorerLeaf) return;

		const container = fileExplorerLeaf.view.containerEl as HTMLElement;

		if (container.querySelector('.tag-filter-bar')) {
			this.tagBarEl = container.querySelector('.tag-filter-bar');
			return;
		}

		this.tagBarEl = container.createDiv('tag-filter-bar');

		const navHeader = container.querySelector('.nav-header');
		if (navHeader) {
			navHeader.after(this.tagBarEl);
		} else {
			container.prepend(this.tagBarEl);
		}

		this.renderTagBar();
	}

	public toggleTagBar() {
		this.injectTagBar();
		this.tagBarEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	private renderTagBar() {
		if (!this.tagBarEl) return;

		this.tagBarEl.empty();
		const tagMap = this.getAllTags();

		const validFilters = this.activeFilters.filter(f => tagMap.has(f.tag));
		if (validFilters.length !== this.activeFilters.length) {
			this.activeFilters = validFilters;
			this.applyToFileExplorer();
		}

		const tags = Array.from(tagMap.entries());

		if (this.settings.sortTagsAlphabetically) {
			tags.sort((a, b) => a[0].localeCompare(b[0]));
		} else {
			tags.sort((a, b) => b[1] - a[1]);
		}

		const header = this.tagBarEl.createDiv('tag-filter-header');
		header.createSpan({ text: '🏷️ Filter:' });

		const clearButton = header.createEl('button', { text: 'Clear All' });
		clearButton.addClass('tag-filter-clear-btn');
		clearButton.onclick = () => {
			this.activeFilters = [];
			this.applyToFileExplorer();
			this.renderTagBar();
		};

		const tagList = this.tagBarEl.createDiv('tag-filter-list');

		for (const [tag, count] of tags) {
			const tagButton = tagList.createDiv('tag-filter-button');

			const filterState = this.activeFilters.find(f => f.tag === tag);
			if (filterState) {
				tagButton.addClass(filterState.mode === 'include' ? 'include' : 'exclude');
			}

			tagButton.createSpan('tag-text').textContent = `#${tag}`;

			if (this.settings.showTagCount) {
				tagButton.createSpan('tag-count').textContent = `(${count})`;
			}

			tagButton.onclick = () => this.cycleTagFilter(tag);
		}

		if (tags.length === 0) {
			tagList.createDiv('tag-filter-empty').textContent = 'No tags found';
		}

		const fileListContainer = this.tagBarEl.createDiv('tag-filter-file-list-container');
		this.renderFileList(fileListContainer);
	}

	private matchesFilters(file: TFile): boolean {
		const cache = this.app.metadataCache.getFileCache(file);
		const fileTags = new Set<string>();

		if (cache?.tags) {
			for (const tag of cache.tags) {
				fileTags.add(tag.tag.startsWith('#') ? tag.tag.slice(1) : tag.tag);
			}
		}

		for (const filter of this.activeFilters) {
			const hasTag = fileTags.has(filter.tag);
			if (filter.mode === 'include' && !hasTag) return false;
			if (filter.mode === 'exclude' && hasTag) return false;
		}

		return true;
	}

	private getFilteredFiles(): TFile[] {
		if (this.activeFilters.length === 0) return [];
		return this.app.vault.getMarkdownFiles().filter(f => this.matchesFilters(f));
	}

	private renderFileList(container: HTMLElement) {
		container.empty();

		if (this.activeFilters.length === 0) return;

		const filteredFiles = this.getFilteredFiles();

		const header = container.createDiv('tag-filter-file-list-header');
		header.createSpan({ text: `📄 Results (${filteredFiles.length})` });

		const fileList = container.createDiv('tag-filter-file-list');

		if (filteredFiles.length === 0) {
			fileList.createDiv('tag-filter-file-empty').textContent = 'No files match the current filters';
			return;
		}

		for (const file of filteredFiles) {
			const fileItem = fileList.createDiv('tag-filter-file-item');

			const fileLink = fileItem.createEl('a', { text: file.basename, href: '#' });
			fileLink.addClass('tag-filter-file-link');
			fileLink.onclick = (e) => {
				e.preventDefault();
				this.app.workspace.openLinkText(file.path, '', false);
			};

			if (file.parent?.name !== '/') {
				fileItem.createDiv('tag-filter-file-path').textContent = file.parent?.name || '';
			}
		}
	}

	private getAllTags(): Map<string, number> {
		const tagMap = new Map<string, number>();

		for (const file of this.app.vault.getMarkdownFiles()) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.tags) {
				for (const tag of cache.tags) {
					const tagName = tag.tag.startsWith('#') ? tag.tag.slice(1) : tag.tag;
					tagMap.set(tagName, (tagMap.get(tagName) || 0) + 1);
				}
			}
		}

		return tagMap;
	}

	private cycleTagFilter(tag: string) {
		const filters = this.activeFilters;
		const currentIndex = filters.findIndex(f => f.tag === tag);

		if (currentIndex === -1) {
			filters.push({ tag, mode: 'include' });
		} else if (filters[currentIndex].mode === 'include') {
			filters[currentIndex].mode = 'exclude';
		} else {
			filters.splice(currentIndex, 1);
		}

		this.setActiveFilters(filters);
	}

	private applyToFileExplorer() {
		const fileExplorerLeaf = this.app.workspace.getLeavesOfType('file-explorer')[0];
		if (!fileExplorerLeaf) return;

		const container = fileExplorerLeaf.view.containerEl as HTMLElement;
		const allFiles = this.app.vault.getMarkdownFiles();
		const filteredPaths = new Set(allFiles.filter(f => this.matchesFilters(f)).map(f => f.path));

		container.querySelectorAll('.nav-file').forEach((item: Element) => {
			const htmlItem = item as HTMLElement;
			const path = (htmlItem as any).file?.path;
			if (path) {
				const visible = this.activeFilters.length === 0 || filteredPaths.has(path);
				htmlItem.style.display = visible ? '' : 'none';
				htmlItem.toggleClass('is-filtered-out', !visible);
			}
		});

		container.querySelectorAll('.nav-folder-contents').forEach((folder: Element) => {
			const htmlFolder = folder as HTMLElement;
			const hasVisible = Array.from(
				htmlFolder.querySelectorAll(':scope > .nav-file, :scope > .nav-folder')
			).some((child) => (child as HTMLElement).style.display !== 'none');
			htmlFolder.style.display = hasVisible ? '' : 'none';
		});

		this.updateStatus(filteredPaths.size, allFiles.length);
	}

	private updateStatus(shown: number, total: number) {
		let statusEl = this.tagBarEl?.querySelector('.tag-filter-status');
		if (!statusEl && this.tagBarEl) {
			statusEl = this.tagBarEl.createDiv('tag-filter-status');
		}
		if (statusEl) {
			if (this.activeFilters.length > 0) {
				statusEl.textContent = `Showing ${shown} of ${total} files`;
				statusEl.addClass('active');
			} else {
				statusEl.removeClass('active');
				statusEl.textContent = '';
			}
		}
	}

	public refreshTagBar() {
		this.renderTagBar();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class TagFilterSettingTab extends PluginSettingTab {
	plugin: TagFilterPlugin;

	constructor(app: App, plugin: TagFilterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Tag Filter Settings' });

		new Setting(containerEl)
			.setName('Show tag count')
			.setDesc('Display the number of files for each tag')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showTagCount)
				.onChange(async (value) => {
					this.plugin.settings.showTagCount = value;
					await this.plugin.saveSettings();
					this.plugin.refreshTagBar();
				}));

		new Setting(containerEl)
			.setName('Sort tags alphabetically')
			.setDesc('Sort tags by name instead of by count')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.sortTagsAlphabetically)
				.onChange(async (value) => {
					this.plugin.settings.sortTagsAlphabetically = value;
					await this.plugin.saveSettings();
					this.plugin.refreshTagBar();
				}));
	}
}
