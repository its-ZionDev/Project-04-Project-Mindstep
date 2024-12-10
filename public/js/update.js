document.addEventListener('DOMContentLoaded', () => {
  const likeButtons = document.querySelectorAll('.like-btn-container');

  likeButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const updateId = button.dataset.updateId;

      if (!updateId) {
        console.error('No update ID found');
        return;
      }

      try {
        const response = await fetch(`/update/like/${updateId}`, {
          method: 'POST',
        });

        const data = await response.json();

        if (data.success) {
          const likesCountElement = button.querySelector('.likes-count');
          likesCountElement.textContent = data.likes;

          button.classList.toggle('liked', data.liked);
        } else {
          alert(data.message || 'Error toggling like');
        }
      } catch (error) {
        console.error('Error toggling like:', error);
      }
    });
  });
});
