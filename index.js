const express = require ('express');
const bodyParser = require ('body-parser');
const dotenv = require ('dotenv');
const path = require ('path');
const ejs = require('ejs');
const { Client } = require('pg');
const pdfParse = require('pdf-parse');
const axios = require('axios');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

//Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));

//Middlewares
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname, 'public')));

//Database Connection
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Connect to the PostgreSQL database
client.connect((err) => {
  if (err) {
    console.error('Error connecting to the database', err.stack);
  } else {
    console.log('Connected to the database');
  }
});

//Routes
app.get('/', (req, res)=>{
    res.render('Welcome');
});

app.get('/Welcome', (req,res)=>{
  res.render('Welcome');
});

app.get('/Synopsis', (req, res)=>{
  res.render('Synopsis');
});

app.get('/Read', async (req,res)=>{
  try{
    const latestChapterQuery = 'SELECT * FROM chapterstest ORDER BY created_at DESC LIMIT 1';
    const latestChapterResult = await client.query(latestChapterQuery);
    const latestChapter = latestChapterResult.rows[0];

    const lastUpdatedDate = new Date(latestChapter.created_at).toLocaleDateString();

    res.render('Read', {
      latestChapter,
      lastUpdatedDate,  
    })
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

app.get('/Book1', async (req, res) => {
  try {
    // Query to fetch the latest chapter
    const latestChapterQuery =
      'SELECT * FROM chapterstest ORDER BY created_at DESC LIMIT 1';
    const latestChapterResult = await client.query(latestChapterQuery);
    const latestChapter = latestChapterResult.rows[0];

    // Query to count total chapters
    const totalChaptersQuery =
      'SELECT COUNT(*) AS total_chapters FROM chapterstest';
    const totalChaptersResult = await client.query(totalChaptersQuery);
    const totalChapters = parseInt(
      totalChaptersResult.rows[0].total_chapters,
      10,
    );

    // Directly get current views for Book1
    const getViewsQuery =
      'SELECT total_views FROM book_views WHERE book_name = $1';
    const getViewsResult = await client.query(getViewsQuery, ['Book1']);

    let totalViews = parseInt(getViewsResult.rows[0].total_views, 10);
    if (isNaN(totalViews)) {
      totalViews = 0;
    }
    totalViews += 1; 

    // Update the views count in the database
    const updateViewsQuery =
      'UPDATE book_views SET total_views = $1 WHERE book_name = $2';
    const updateResult = await client.query(updateViewsQuery, [
      totalViews,
      'Book1',
    ]);

    // Calculate days ago for the latest chapter
    const daysAgo = Math.floor(
      (Date.now() - new Date(latestChapter.created_at).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    const daysAgoText =
      daysAgo === 0 ? 'today' : `${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`;

    // Render the Book1 page with updated views
    res.render('Book1', {
      totalChapters,
      latestChapter,
      daysAgoText,
      totalViews,
    });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).send('Server error');
  }
});

app.get('/Book1_User_Reviews',(req,res)=>{
  res.render('Book1_User_Reviews');
});

app.get('/Book1_Novel_Chapters', async (req,res)=>{
  try {

    const allChaptersQuery = 'SELECT * FROM chapterstest ORDER BY created_at DESC';
    const allChaptersResult = await client.query(allChaptersQuery);
    
    const allChapters = allChaptersResult.rows.map((chapter) => {
      const daysAgo = Math.floor(
        (Date.now() - new Date(chapter.created_at).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      return {
        ...chapter,
        daysAgo:
          daysAgo === 0
            ? 'today'
            : `${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`,
      };
    });

    allChapters.reverse();

    const totalChapters = allChapters.length;
    const latestChapter = allChapters[allChapters.length - 1]; 
    res.render('Book1_Novel_Chapters', {
      allChapters,
      totalChapters,
      latestChapter,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

app.get('/Read_Chapter', async (req, res) => {
  const chapterNo = req.query.chapter_no; 

  if (!chapterNo) {
    return res.status(400).send('Chapter number is required.');
  }

  try {
    // Fetch chapter data from the database using chapter_no
    const chapterQuery = 'SELECT * FROM chapterstest WHERE chapter_no = $1';
    const chapterResult = await client.query(chapterQuery, [chapterNo]);

    if (chapterResult.rows.length === 0) {
      return res.status(404).send('Chapter not found.');
    }

    const chapter = chapterResult.rows[0];

    // Check if the chapter is already parsed as an object
    let chapterData = chapter.chapter;
    if (typeof chapterData === 'string') {
      // If it's a string (JSON), parse it
      chapterData = JSON.parse(chapterData);
    }

    res.render('Read_Chapter', {
      chapter: chapterData, 
    });
  } catch (err) {
    console.error('Error fetching chapter:', err.message);
    res.status(500).send('Error fetching chapter data.');
  }
});

//Port
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
