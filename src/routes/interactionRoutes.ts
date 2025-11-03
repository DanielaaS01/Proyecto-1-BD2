import { Router } from 'express';
import { 
  recordInteraction,
  getUserInteractions,
  getBookInteractions,
  getInteractionStats,
  getMostActiveUsers,
  recordBookView,
  recordBookRating,
  addToWishlist,
  getReviewBreakdown // <-- AÑADIDO
} from '../controllers/interactionController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Todas las rutas requieren autenticación
router.get('/breakdown/:bookId', getReviewBreakdown);
router.use(authenticate);

// Rutas principales
router.post('/', recordInteraction);
router.get('/user', getUserInteractions);
router.get('/book/:bookId', getBookInteractions);
router.get('/stats', getInteractionStats);
router.get('/active-users', getMostActiveUsers);

// Rutas simplificadas para acciones específicas
router.post('/books/:bookId/view', recordBookView);
router.post('/books/:bookId/rate', recordBookRating);
router.post('/books/:bookId/wishlist', addToWishlist);

export default router;