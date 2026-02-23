document.addEventListener('DOMContentLoaded', () => {
  const folderUpload = document.getElementById('folder-upload');
  const resultsContainer = document.getElementById('results-container');

  // Check if stringSimilarity is loaded
  if (typeof stringSimilarity === 'undefined') {
    console.error('string-similarity library not loaded. Please check the CDN link.');
    return;
  }

  const normalize = (name) => {
    return name
      .replace(/\.[^/.]+$/, '') // remove extension
      .replace(/[\d_\-]+/g, ' ') // replace numbers, underscores, hyphens with space
      .replace(/\s+/g, ' ') // collapse multiple spaces
      .trim()
      .toLowerCase();
  };

  const groupFiles = (files) => {
    const groups = new Map();
    if (files.length === 0) return groups;

    for (const file of files) {
      const normalizedName = normalize(file.name);
      if (groups.size === 0) {
        groups.set(file.name, [file]);
        continue;
      }

      const groupKeys = Array.from(groups.keys());
      const normalizedGroupKeys = groupKeys.map(normalize);

      const { bestMatch, bestMatchIndex } = stringSimilarity.findBestMatch(normalizedName, normalizedGroupKeys);

      if (bestMatch.rating > 0.6) {
        const bestGroupKey = groupKeys[bestMatchIndex];
        groups.get(bestGroupKey).push(file);
      } else {
        groups.set(file.name, [file]);
      }
    }
    return groups;
  };

  const renderResults = (files, groupedFiles) => {
    resultsContainer.innerHTML = ''; // Clear previous results

    if (files.length === 0) return;

    // Info header
    const infoDiv = document.createElement('div');
    infoDiv.className = 'results-info';
    infoDiv.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      <p><b>${files.length} files</b> loaded successfully. Found <b>${groupedFiles.size}</b> potential groups.</p>
    `;
    resultsContainer.appendChild(infoDiv);

    // Render groups
    for (const [groupName, filesInGroup] of groupedFiles.entries()) {
      let authenticity = 100;
      if (filesInGroup.length > 1) {
        const ratings = filesInGroup.map(file => 
          stringSimilarity.compareTwoStrings(normalize(groupName), normalize(file.name))
        );
        const averageRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
        authenticity = Math.round(averageRating * 100);
      }

      const groupEl = document.createElement('div');
      groupEl.className = 'file-group';

      let filesHTML = '';
      filesInGroup.forEach(file => {
        filesHTML += `
          <div class="file-item">
            <div class="file-item-name">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span>${file.name}</span>
            </div>
            <button class="file-item-info-btn" data-name="${file.name}" data-path="${file.path}" data-type="${file.type}" title="View file details">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </button>
          </div>
        `;
      });

      groupEl.innerHTML = `
        <div class="file-group-header">
          <div class="file-group-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            <h3>${groupName}</h3>
          </div>
          <div class="file-group-authenticity">
            <div class="authenticity-dot"></div>
            <span>${authenticity}% Authentic</span>
          </div>
        </div>
        <div class="file-list">${filesHTML}</div>
      `;
      resultsContainer.appendChild(groupEl);
    }
  };

  const showModal = (file) => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>File Details</h3>
          <button class="modal-close-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="modal-body-row"><span class="label">Name:</span><span class="value">${file.name}</span></div>
          <div class="modal-body-row"><span class="label">Path:</span><span class="value">${file.path}</span></div>
          <div class="modal-body-row"><span class="label">Type:</span><span class="value">${file.type || 'N/A'}</span></div>
        </div>
      </div>
    `;
    
    const close = () => document.body.removeChild(modal);
    modal.addEventListener('click', close);
    modal.querySelector('.modal-content').addEventListener('click', (e) => e.stopPropagation());
    modal.querySelector('.modal-close-btn').addEventListener('click', close);

    document.body.appendChild(modal);
  };

  folderUpload.addEventListener('change', (event) => {
    if (event.target.files) {
      const fileList = Array.from(event.target.files).map(file => ({
        name: file.name,
        path: file.webkitRelativePath || file.name,
        type: file.type,
      }));
      const grouped = groupFiles(fileList);
      renderResults(fileList, grouped);
    }
  });

  resultsContainer.addEventListener('click', (event) => {
    const button = event.target.closest('.file-item-info-btn');
    if (button) {
      const { name, path, type } = button.dataset;
      showModal({ name, path, type });
    }
  });
});
