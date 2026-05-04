export function createNewTabScript(): string {
  return `
      document.getElementById('search-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const query = document.getElementById('search-input').value.trim();
        if (query) {
          window.location.href = 'https://www.google.com/search?q=' + encodeURIComponent(query);
        }
      });

      const importBtn = document.getElementById('import-pdf-btn');
      if (importBtn) {
        importBtn.addEventListener('click', async () => {
          if (!window.improvement?.importPdfResource) {
            alert('PDF import functionality is not available in this browser context.');
            return;
          }

          const originalText = importBtn.textContent;
          importBtn.textContent = 'Importing PDF...';
          importBtn.disabled = true;

          try {
            const resource = await window.improvement.importPdfResource();
            if (resource?.title) {
              console.log('PDF imported and opened in new tab:', resource.title);
            }
          } catch (error) {
            console.error('PDF import error:', error);
            alert('Sorry, could not import the PDF. Make sure it is a valid PDF file.');
          } finally {
            importBtn.textContent = originalText;
            importBtn.disabled = false;
          }
        });
      }
    `
}
