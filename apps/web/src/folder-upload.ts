export function isSupportedNote(file: File): boolean {
    return /\.(pdf|md|txt)$/i.test(file.name);
}
function readFile(entry: FileSystemFileEntry): Promise<File> {
    return new Promise((resolve, reject) => entry.file(resolve, reject));
}
async function walkEntry(entry: FileSystemEntry, errors: string[]): Promise<File[]> {
    if (entry.isFile) {
        try {
            return [await readFile(entry as FileSystemFileEntry)];
        }
        catch {
            errors.push(`Cannot read ${entry.fullPath || entry.name}. Select this file again to retry.`);
            return [];
        }
    }
    if (!entry.isDirectory)
        return [];
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const files: File[] = [];
    // Chromium returns directories in batches, so reading once can omit files.
    while (true) {
        let entries: FileSystemEntry[];
        try {
            entries = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
        }
        catch {
            errors.push(`Cannot read folder ${entry.fullPath || entry.name || "entry"}. Choose it again to retry.`);
            break;
        }
        if (!entries.length)
            break;
        for (const child of entries)
            files.push(...await walkEntry(child, errors));
    }
    return files;
}
export async function droppedFiles(transfer: DataTransfer): Promise<{
    files: File[];
    errors: string[];
}> {
    const errors: string[] = [];
    const roots = Array.from(transfer.items).filter(item => item.kind === 'file').map(item => ({
        entry: item.webkitGetAsEntry?.(), file: item.getAsFile(),
    }));
    if (!roots.length)
        return { files: Array.from(transfer.files), errors };
    const files: File[] = [];
    for (const root of roots) {
        if (root.entry)
            files.push(...await walkEntry(root.entry, errors));
        else if (root.file)
            files.push(root.file);
    }
    return { files, errors };
}
