const stars = document.querySelectorAll('.review-star-rating i');

stars.forEach((star, index1) => {
  star.addEventListener('click', () => {
    stars.forEach((star, index2) => {
      index2 <= index1
        ? star.classList.add('active')
        : star.classList.remove('active');
    });
  });
});

function resetStarRating() {
  document.querySelectorAll('.review-star-rating i').forEach((star) => {
    star.classList.remove('active');
  });
}

document.querySelector('.review-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(e.target);
  const reviewData = {
    chapter: formData.get('chapter'),
    author: formData.get('author'),
    content: formData.get('content'),
    stars: document.querySelectorAll('.review-star-rating i.active').length,
  };

  try {
    const response = await fetch('/book1/reviews', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reviewData),
    });

    if (!response.ok) throw new Error('Failed to submit review');

    const newReview = await response.json();
    addReviewToDOM(newReview);
    e.target.reset();
    resetStarRating();
  } catch (error) {
    console.error('Error submitting review:', error);
  }
});

function addReviewToDOM(review) {
  const reviewContainer = document.querySelector('.main-book-reviews');
  const reviewCard = document.createElement('div');
  reviewCard.className = 'main-book-review-card';

  reviewCard.innerHTML = `
    <div class="review-card-header">
      <div class="review-author-info">
        <span class="review-author">${review.name}</span>
        <span class="review-category">Reader</span>
      </div>
      <div class="review-info">
        <span class="review-chapter">Chapter ${review.chapter_no}</span>
        <span class="review-time">${new Date(
          review.created_at,
        ).toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
        })}</span>
      </div>
    </div>
    <div class="review-star"></div>
    <div class="review-content">
      <p>${review.review}</p>
    </div>
    <div class="review-actions">
      <div class="reply-btn-container">
        <i class="fa-solid fa-comments"></i>
        <button class="reply-btn">Reply</button>
      </div>
      <div class="like-btn-container">
        <span class="like-btn"><i class="ri-thumb-up-fill"></i></span>
        <span class="like-count">0</span>
      </div>
    </div>
  `;

  const starContainer = reviewCard.querySelector('.review-star');
  for (let i = 0; i < 5; i++) {
    const star = document.createElement('i');
    star.className = 'fa-solid fa-star';
    if (i < review.stars) {
      star.style.color = '#ff9c1a';
    } else {
      star.style.color = '#a1a3b3';
    }
    starContainer.appendChild(star);
  }

  reviewContainer.prepend(reviewCard);
}

document.addEventListener('DOMContentLoaded', () => {
  const reviewLikeButtons = document.querySelectorAll(
    '.like-btn-container[data-review-s-no]',
  );
  reviewLikeButtons.forEach((button) => {
    button.addEventListener('click', async (event) => {
      if (!event.target.closest('.like-btn')) return;

      const s_no = button.dataset.reviewSNo;

      if (!s_no) {
        console.error('No s_no found');
        return;
      }

      try {
        const response = await fetch(`/book1/reviews/like/${s_no}`, {
          method: 'POST',
        });
        const data = await response.json();

        if (data.success) {
          const likeCountElement = button.querySelector('.like-count');
          likeCountElement.textContent = data.likes;

          button.classList.toggle('liked', data.liked);
        } else {
          alert(data.message || 'Error toggling like');
        }
      } catch (error) {
        console.error('Error toggling review like:', error);
      }
    });
  });
});

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.reply-btn').forEach((button) => {
    button.addEventListener('click', function () {
      const reviewId = this.getAttribute('data-review-s_no');
      const formId = `reply-form-${reviewId}`;
      const replyForm = document.getElementById(formId);

      replyForm.classList.toggle('show');
    });
  });
});

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.reply-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const reviewSNo = form.closest('.reply-form-container').dataset.reviewSNo;
      const formData = new FormData(form);
      formData.append('review_s_no', reviewSNo);

      try {
        const response = await fetch('/book1/reviews/reply', {
          method: 'POST',
          body: new URLSearchParams(formData),
        });

        const data = await response.json();

        if (data.success) {
          const newReplyHTML = `
            <div class="reply">
              <div class="reply-container">
                <div class="reply-header">
                  <span class="reply-author">${data.reply.name}</span>
                  <span class="reply-time">${new Date(
                    data.reply.created_at,
                  ).toLocaleDateString()}</span>
                </div>
                <div class="reply-content">
                  <p>${data.reply.content}</p>
                </div>
                <div class="reply-actions">
                  <div class="like-btn-container" data-reply-id="${
                    data.reply.id
                  }">
                    <span class="like-btn"><i class="ri-thumb-up-fill"></i></span>
                    <span class="like-count">0</span>
                  </div>
                </div>
              </div>
            </div>
          `;
          const repliesContainer = form
            .closest('.main-book-review-card')
            .querySelector('.replies');
          repliesContainer.insertAdjacentHTML('beforeend', newReplyHTML);
          form.reset();
        } else {
          alert(data.message || 'Error posting reply.');
        }
      } catch (error) {
        console.error('Error submitting reply:', error);
        alert('Something went wrong. Please try again later.');
      }
    });
  });
});

document.addEventListener('DOMContentLoaded', () => {
  const replyLikeButtons = document.querySelectorAll(
    '.like-btn-container[data-reply-id]',
  );

  replyLikeButtons.forEach((button) => {
    button.addEventListener('click', async (event) => {
      if (!event.target.closest('.like-btn')) return;

      const replyId = button.dataset.replyId;

      if (!replyId) {
        console.error('No reply ID found');
        return;
      }

      try {
        const response = await fetch(`/book1/reviews/reply/like/${replyId}`, {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          const likeCountElement = button.querySelector('.like-count');
          likeCountElement.textContent = data.likes;

          button.classList.toggle('liked', data.liked);
        } else {
          alert(data.message || 'Error toggling like');
        }
      } catch (error) {
        console.error('Error toggling reply like:', error);
      }
    });
  });
});
