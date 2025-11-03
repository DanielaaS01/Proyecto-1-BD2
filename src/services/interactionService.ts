import mongoose from 'mongoose'; // <-- Importación necesaria
import UserInteraction, { IUserInteraction, InteractionType } from '../models/UserInteraction';
import Book from '../models/Book';
import {
  RecordInteractionRequest,
  UserInteractionsRequest,
  BookInteractionsRequest,
  InteractionResponse,
  InteractionStats
} from '../types/interaction';

export class InteractionService {

  /**
   * Registrar o actualizar una interacción de usuario (CORREGIDO)
   */
  static async recordInteraction(request: RecordInteractionRequest): Promise<InteractionResponse> {
    try {
      const { userId, bookId, interactionType, ratingValue, timeOnPage, sessionId } = request;

      // 1. VALIDACIONES BÁSICAS
      if (!userId || !bookId || !interactionType || !sessionId) {
        return { success: false, message: 'userId, bookId, interactionType y sessionId son requeridos' };
      }
      const book = await Book.findById(bookId);
      if (!book) {
        return { success: false, message: 'Libro no encontrado' };
      }

      let interaction: IUserInteraction | null;

      // 2. LÓGICA DE INTERACCIÓN (CORREGIDA)
      if (interactionType === 'rating') {
        if (ratingValue === undefined || ratingValue < 1 || ratingValue > 5) {
          return { success: false, message: 'ratingValue es requerido (1-5) para interacciones de rating' };
        }
        
        // --- LÓGICA DE "UPSERT" PARA VALORACIONES ---
        // (Quitamos .lean() para que devuelva un documento Mongoose completo)
        interaction = await UserInteraction.findOneAndUpdate(
          { userId, bookId, interactionType: 'rating' }, // El filtro
          { $set: { ratingValue, sessionId, timestamp: new Date() } }, // Los datos
          { new: true, upsert: true } // Opciones
        );

        // 3. RECALCULAR PROMEDIOS
        await this.recalculateBookRatings(bookId); // <-- Esto ahora funciona

      } else {
        // --- LÓGICA DE CREACIÓN (COMO ANTES) PARA VISTAS O WISHLIST ---
        if (interactionType === 'view' && (timeOnPage === undefined || timeOnPage < 0)) {
          return { success: false, message: 'timeOnPage es requerido para interacciones de view' };
        }

        interaction = new UserInteraction({
          userId, bookId, interactionType, timeOnPage, sessionId, timestamp: new Date()
        });
        await interaction.save();

        if (interactionType === 'view') {
          await Book.findByIdAndUpdate(bookId, { $inc: { viewCount: 1 } });
        }
      }

      return {
        success: true,
        message: 'Interacción registrada exitosamente',
        data: { interaction }
      };

    } catch (error: any) {
      console.error('Error en servicio de registro de interacción:', error);
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map((err: any) => err.message);
        return { success: false, message: 'Error de validación', error: errors.join(', ') };
      }
      if (error.name === 'CastError') {
        return { success: false, message: 'ID de usuario o libro no válido' };
      }
      return {
        success: false,
        message: 'Error interno del servidor al registrar interacción',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  }

  /**
   * Recalcula el ratingCount y averageRating de un libro (CORREGIDO)
   */
  private static async recalculateBookRatings(bookId: string): Promise<void> {
    try {
      const stats = await UserInteraction.aggregate([
        {
          $match: {
            bookId: new mongoose.Types.ObjectId(bookId), // <-- Necesitamos mongoose.Types
            interactionType: 'rating'
          }
        },
        {
          $group: {
            _id: '$bookId',
            averageRating: { $avg: '$ratingValue' }, 
            ratingCount: { $sum: 1 } 
          }
        }
      ]);

      let averageRating = 0;
      let ratingCount = 0;

      if (stats.length > 0) {
        averageRating = Math.round(stats[0].averageRating * 10) / 10;
        ratingCount = stats[0].ratingCount;
      }

      await Book.findByIdAndUpdate(bookId, {
        $set: {
          averageRating: averageRating,
          ratingCount: ratingCount
        }
      });

    } catch (error) {
      console.error(`Error recalculando métricas para el libro ${bookId}:`, error);
    }
  }

  /**
   * Obtener historial de interacciones de un usuario
   */
  static async getUserInteractions(request: UserInteractionsRequest): Promise<InteractionResponse> {
    try {
      const { userId, limit = 20, page = 1 } = request;
      const skip = (page - 1) * limit;
      const [interactions, total] = await Promise.all([
        UserInteraction.find({ userId })
          .populate('bookId')
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        UserInteraction.countDocuments({ userId })
      ]);
      const totalPages = Math.ceil(total / limit);
      return {
        success: true,
        message: 'Interacciones del usuario obtenidas exitosamente',
        data: {
          interactions,
          pagination: { page, limit, total, totalPages }
        }
      };
    } catch (error: any) {
      console.error('Error en servicio de interacciones de usuario:', error);
      if (error.name === 'CastError') {
        return { success: false, message: 'ID de usuario no válido' };
      }
      return {
        success: false,
        message: 'Error al obtener interacciones del usuario',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  }

  /**
   * Obtener interacciones de un libro específico
   */
  static async getBookInteractions(request: BookInteractionsRequest): Promise<InteractionResponse> {
    try {
      const { bookId, limit = 20, page = 1 } = request;
      const skip = (page - 1) * limit;
      const [interactions, total] = await Promise.all([
        UserInteraction.find({ bookId })
          .populate('userId', 'username preferences.favoriteGenres')
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        UserInteraction.countDocuments({ bookId })
      ]);
      const totalPages = Math.ceil(total / limit);
      return {
        success: true,
        message: 'Interacciones del libro obtenidas exitosamente',
        data: {
          interactions,
          pagination: { page, limit, total, totalPages }
        }
      };
    } catch (error: any) {
      console.error('Error en servicio de interacciones de libro:', error);
      if (error.name === 'CastError') {
        return { success: false, message: 'ID de libro no válido' };
      }
      return {
        success: false,
        message: 'Error al obtener interacciones del libro',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  }

  /**
   * Obtener estadísticas de interacciones
   */
  static async getInteractionStats(userId?: string, bookId?: string): Promise<{ success: boolean; data?: InteractionStats; message?: string }> {
    try {
      const matchStage: any = {};
      
      // Corregido: convertir strings a ObjectIds para la consulta
      if (userId) matchStage.userId = new mongoose.Types.ObjectId(userId as string); 
      if (bookId) matchStage.bookId = new mongoose.Types.ObjectId(bookId as string); 

      const stats = await UserInteraction.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalViews: {
              $sum: { $cond: [{ $eq: ['$interactionType', 'view'] }, 1, 0] }
            },
            totalRatings: {
              $sum: { $cond: [{ $eq: ['$interactionType', 'rating'] }, 1, 0] }
            },
            totalWishlists: {
              $sum: { $cond: [{ $eq: ['$interactionType', 'wishlist'] }, 1, 0] }
            },
            averageRating: { $avg: '$ratingValue' },
            totalInteractions: { $sum: 1 }
          }
        }
      ]);
      const result = stats[0] || {
        totalViews: 0,
        totalRatings: 0,
        totalWishlists: 0,
        averageRating: 0,
        totalInteractions: 0
      };
      return {
        success: true,
        data: {
          totalViews: result.totalViews,
          totalRatings: result.totalRatings,
          totalWishlists: result.totalWishlists,
          averageRating: Math.round(result.averageRating * 10) / 10 || 0
        }
      };
    } catch (error: any) {
      console.error('Error obteniendo estadísticas de interacciones:', error);
      return {
        success: false,
        message: 'Error al obtener estadísticas de interacciones'
      };
    }
  }

  /**
   * Obtener usuarios más activos
   */
  static async getMostActiveUsers(limit: number = 10): Promise<{ success: boolean; data?: any[]; message?: string }> {
    try {
      const activeUsers = await UserInteraction.aggregate([
        {
          $group: {
            _id: '$userId',
            interactionCount: { $sum: 1 },
            lastActivity: { $max: '$timestamp' }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        {
          $project: {
            'user.password': 0,
            'user.__v': 0
          }
        },
        { $sort: { interactionCount: -1, lastActivity: -1 } },
        { $limit: limit }
      ]);
      return {
        success: true,
        data: activeUsers
      };
    } catch (error: any) {
      console.error('Error obteniendo usuarios activos:', error);
      return {
        success: false,
        message: 'Error al obtener usuarios activos'
      };
    }
  }

  /**
   * Obtener el desglose de calificaciones (rating breakdown) para un libro
   */
  static async getReviewBreakdown(bookId: string): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      if (!mongoose.Types.ObjectId.isValid(bookId)) {
        return { success: false, message: 'ID de libro no válido' };
      }
      const breakdown = await UserInteraction.aggregate([
        {
          $match: {
            bookId: new mongoose.Types.ObjectId(bookId),
            interactionType: 'rating'
          }
        },
        {
          $group: {
            _id: '$ratingValue', 
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: -1 } }
      ]);
      const formattedData: { [key: number]: number } = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      let total = 0;
      breakdown.forEach(item => {
        if (item._id >= 1 && item._id <= 5) {
          formattedData[item._id] = item.count;
          total += item.count;
        }
      });
      return {
        success: true,
        data: {
          breakdown: formattedData,
          totalReviews: total
        }
      };
    } catch (error: any) {
      console.error('Error obteniendo desglose de reseñas:', error);
      return {
        success: false,
        message: 'Error al obtener desglose de reseñas'
      };
    }
  }
}