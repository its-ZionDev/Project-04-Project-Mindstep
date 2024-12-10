document.addEventListener('DOMContentLoaded', () => {
  const likeButtons = document.querySelectorAll('.like-btn-container');

  likeButtons.forEach((button) => {
    button.addEventListener('click', async (event) => {
      if (!event.target.closest('.like-btn')) return;

      const commentId = button.dataset.commentId || button.dataset.replyId;

      if (!commentId) {
        console.error('No comment or reply ID found');
        return;
      }

      try {
        const response = await fetch(
          `/read_chapter/like/${commentId}`,
          {
            method: 'POST',
          },
        );
        const data = await response.json();

        if (data.success) {
          const likeCountElement = button.querySelector('.like-count');
          likeCountElement.textContent = data.likes;

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
  <button class="reply-btn">Reply</button>
  <div class="like-btn-container" data-comment-id="${newComment.id}">
    <span class="like-btn"><i class="ri-thumb-up-fill"></i></span>
    <span class="like-count">${newComment.likes}</span>
  </div>
</div>
`;
  commentContainer.prepend(commentElement);
}

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.reply-btn').forEach((button) => {
    button.addEventListener('click', function () {
      const commentId = this.getAttribute('data-comment-id');
      const formId = `reply-form-${commentId}`;
      const replyForm = document.getElementById(formId);

      replyForm.classList.toggle('show');
    });
  });
});

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
