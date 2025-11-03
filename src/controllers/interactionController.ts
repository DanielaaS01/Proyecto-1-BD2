import { Response } from 'express';
import { 
  InteractionService 
} from '../services/interactionService';
import { AuthRequest } from '../types/auth';

/**
 * Controlador para registrar una interacción
 */
export const recordInteraction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
      return;
    }

    const { bookId, interactionType, ratingValue, timeOnPage, sessionId } = req.body;

    // Validar campos requeridos
    if (!bookId || !interactionType || !sessionId) {
      res.status(400).json({
        success: false,
        message: 'bookId, interactionType y sessionId son requeridos'
      });
      return;
    }

    const response = await InteractionService.recordInteraction({
      userId: req.user._id.toString(),
      bookId,
      interactionType,
      ratingValue,
      timeOnPage,
      sessionId
    });

    res.status(response.success ? 201 : 400).json(response);

  } catch (error) {
    console.error('Error en controlador de registro de interacción:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Controlador para obtener interacciones del usuario actual
 */
export const getUserInteractions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
      return;
    }

    const { limit = '20', page = '1' } = req.query;

    const response = await InteractionService.getUserInteractions({
      userId: req.user._id.toString(),
      limit: parseInt(String(limit), 10),
      page: parseInt(String(page), 10)
    });

    res.status(response.success ? 200 : 400).json(response);

  } catch (error) {
    console.error('Error en controlador de interacciones de usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Controlador para obtener interacciones de un libro específico
 */
export const getBookInteractions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { bookId } = req.params;
    const { limit = '20', page = '1' } = req.query;

    if (!bookId) {
      res.status(400).json({
        success: false,
        message: 'ID de libro requerido'
      });
      return;
    }

    const response = await InteractionService.getBookInteractions({
      bookId,
      limit: parseInt(String(limit), 10),
      page: parseInt(String(page), 10)
    });

    res.status(response.success ? 200 : 400).json(response);

  } catch (error) {
    console.error('Error en controlador de interacciones de libro:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Controlador para obtener estadísticas de interacciones
 */
export const getInteractionStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, bookId } = req.query;

    const response = await InteractionService.getInteractionStats(
      userId as string,
      bookId as string
    );

    if (response.success) {
      res.json({
        success: true,
        data: response.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: response.message
      });
    }

  } catch (error) {
    console.error('Error en controlador de estadísticas de interacciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Controlador para obtener usuarios más activos
 */
export const getMostActiveUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { limit = '10' } = req.query;

    const response = await InteractionService.getMostActiveUsers(
      parseInt(String(limit), 10)
    );

    if (response.success) {
      res.json({
        success: true,
        data: response.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: response.message
      });
    }

  } catch (error) {
    console.error('Error en controlador de usuarios activos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Controlador simplificado para registrar una vista de libro
 */
export const recordBookView = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
      return;
    }

    const { bookId } = req.params;
    const { timeOnPage = 30 } = req.body; // Tiempo por defecto: 30 segundos

    if (!bookId) {
      res.status(400).json({
        success: false,
        message: 'ID de libro requerido'
      });
      return;
    }

    const response = await InteractionService.recordInteraction({
      userId: req.user._id.toString(),
      bookId,
      interactionType: 'view',
      timeOnPage,
      sessionId: `session_${Date.now()}_${req.user._id}`
    });

    res.status(response.success ? 201 : 400).json(response);

  } catch (error) {
    console.error('Error en controlador de registro de vista:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Controlador simplificado para registrar un rating de libro
 */
export const recordBookRating = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
      return;
    }

    const { bookId } = req.params;
    const { ratingValue } = req.body;

    if (!bookId) {
      res.status(400).json({
        success: false,
        message: 'ID de libro requerido'
      });
      return;
    }

    if (!ratingValue || ratingValue < 1 || ratingValue > 5) {
      res.status(400).json({
        success: false,
        message: 'ratingValue es requerido y debe ser entre 1-5'
      });
      return;
    }

    const response = await InteractionService.recordInteraction({
      userId: req.user._id.toString(),
      bookId,
      interactionType: 'rating',
      ratingValue,
      sessionId: `session_${Date.now()}_${req.user._id}`
    });

    res.status(response.success ? 201 : 400).json(response);

  } catch (error) {
    console.error('Error en controlador de registro de rating:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Controlador simplificado para agregar a wishlist
 */
export const addToWishlist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
      return;
    }

    const { bookId } = req.params;

    if (!bookId) {
      res.status(400).json({
        success: false,
        message: 'ID de libro requerido'
      });
      return;
    }

    const response = await InteractionService.recordInteraction({
      userId: req.user._id.toString(),
      bookId,
      interactionType: 'wishlist',
      sessionId: `session_${Date.now()}_${req.user._id}`
    });

    res.status(response.success ? 201 : 400).json(response);

  } catch (error) {
    console.error('Error en controlador de agregar a wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Controlador para obtener el desglose de reseñas de un libro
 */
export const getReviewBreakdown = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { bookId } = req.params;
    if (!bookId) {
      res.status(400).json({ success: false, message: 'ID de libro requerido' });
      return;
    }

    const response = await InteractionService.getReviewBreakdown(bookId);
    res.status(response.success ? 200 : 500).json(response);

  } catch (error) {
    console.error('Error en controlador de desglose de reseñas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};