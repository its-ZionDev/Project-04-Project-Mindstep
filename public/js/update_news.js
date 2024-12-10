document.addEventListener('DOMContentLoaded', () => {
  const loadCommentsBtn = document.getElementById('load-comments-btn');
  const commentsContainer = document.getElementById('comments-container');

  if (loadCommentsBtn && commentsContainer) {
    loadCommentsBtn.addEventListener('click', () => {
      
      commentsContainer.classList.toggle('hidden');

      if (commentsContainer.classList.contains('hidden')) {
        loadCommentsBtn.textContent = 'Load Comments';
      } else {
        loadCommentsBtn.textContent = 'Hide Comments';
      }
    });
  }
});

function updateComments(newComment) {
  const commentContainer = document.getElementById('comments-container');

  const commentElement = document.createElement('div');
  commentElement.classList.add('comment');
  commentElement.innerHTML = `
    <div class="comment-header">
      <span class="comment-author">${newComment.name}</span>
      <span class="comment-time">${new Date(
        newComment.created_at,
      ).toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      })}</span>
    </div>
    <div class="comment-content">
      <p>${newComment.content}</p>
    </div>
    <div class="comment-actions">
      <div class="like-btn-container" data-comment-id="${newComment.s_no}">
        <span class="like-btn"><i class="ri-thumb-up-fill"></i></span>
        <span class="like-count">${newComment.likes}</span>
      </div>
    </div>
  `;
  commentContainer.prepend(commentElement);
}

document.addEventListener('DOMContentLoaded', () => {
  const likeButtons = document.querySelectorAll('.like-btn-container');

  likeButtons.forEach((button) => {
    button.addEventListener('click', async (event) => {
      if (!event.target.closest('.like-btn')) return;

      const commentId = button.dataset.commentId;

      if (!commentId) {
        console.error('No comment ID (s_no) found');
        return;
      }

      try {
        const response = await fetch(`/update_news/like/${commentId}`, {
          method: 'POST',
        });
        const data = await response.json();

        if (data.success) {
          const likeCountElement = button.querySelector('.like-count');
          likeCountElement.textContent = data.likes;

          button.classList.toggle('liked', data.liked);

          document.cookie = `liked_post_${commentId}=${data.liked}; path=/; max-age=31536000`; 
        } else {
          alert(data.message || 'Error toggling like');
        }
      } catch (error) {
        console.error('Error toggling like:', error);
      }
    });
  });
});


