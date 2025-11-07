export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string
          code: string
          nom: string
          forme: string | null
          dosage: string | null
          unite: string | null
          seuil_alerte: number | null
          classe_therapeutique: string | null
          actif: boolean | null
          stock_actuel: number | null
          prix_unitaire: number | null
          valeur_stock: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          code: string
          nom: string
          forme?: string | null
          dosage?: string | null
          unite?: string | null
          seuil_alerte?: number | null
          classe_therapeutique?: string | null
          actif?: boolean | null
          stock_actuel?: number | null
          prix_unitaire?: number | null
          valeur_stock?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          code?: string
          nom?: string
          forme?: string | null
          dosage?: string | null
          unite?: string | null
          seuil_alerte?: number | null
          classe_therapeutique?: string | null
          actif?: boolean | null
          stock_actuel?: number | null
          prix_unitaire?: number | null
          valeur_stock?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      mouvements: {
        Row: {
          id: string
          product_id: string
          type_mouvement: 'ENTREE' | 'SORTIE' | 'AJUSTEMENT' | 'OUVERTURE' | 'MISE_AU_REBUT'
          quantite: number
          date_mouvement: string
          mois: string
          note: string | null
          created_by: string
          prix_unitaire: number | null
          valeur_totale: number | null
          solde_apres: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          product_id: string
          type_mouvement: 'ENTREE' | 'SORTIE' | 'AJUSTEMENT' | 'OUVERTURE' | 'MISE_AU_REBUT'
          quantite: number
          date_mouvement?: string
          mois: string
          note?: string | null
          created_by: string
          prix_unitaire?: number | null
          valeur_totale?: number | null
          solde_apres?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          product_id?: string
          type_mouvement?: 'ENTREE' | 'SORTIE' | 'AJUSTEMENT' | 'OUVERTURE' | 'MISE_AU_REBUT'
          quantite?: number
          date_mouvement?: string
          mois?: string
          note?: string | null
          created_by?: string
          prix_unitaire?: number | null
          valeur_totale?: number | null
          solde_apres?: number | null
          created_at?: string | null
        }
      }
      inventaires: {
        Row: {
          id: string
          mois: string
          statut: 'BROUILLON' | 'VALIDE'
          validated_by: string | null
          validated_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          mois: string
          statut?: 'BROUILLON' | 'VALIDE'
          validated_by?: string | null
          validated_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          mois?: string
          statut?: 'BROUILLON' | 'VALIDE'
          validated_by?: string | null
          validated_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      lignes_inventaire: {
        Row: {
          id: string
          inventaire_id: string
          product_id: string
          stock_theorique: number | null
          stock_physique: number | null
          ecart: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          inventaire_id: string
          product_id: string
          stock_theorique?: number | null
          stock_physique?: number | null
          ecart?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          inventaire_id?: string
          product_id?: string
          stock_theorique?: number | null
          stock_physique?: number | null
          ecart?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      peremptions: {
        Row: {
          id: string
          product_id: string
          date_peremption: string
          quantite: number
          emplacement: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          product_id: string
          date_peremption: string
          quantite?: number
          emplacement?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          product_id?: string
          date_peremption?: string
          quantite?: number
          emplacement?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      transferts_stock: {
        Row: {
          id: string
          mois_source: string
          mois_destination: string
          nb_produits: number | null
          created_by: string
          created_at: string | null
        }
        Insert: {
          id?: string
          mois_source: string
          mois_destination: string
          nb_produits?: number | null
          created_by: string
          created_at?: string | null
        }
        Update: {
          id?: string
          mois_source?: string
          mois_destination?: string
          nb_produits?: number | null
          created_by?: string
          created_at?: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          nom: string
          role: 'ADMIN' | 'USER'
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          nom: string
          role?: 'ADMIN' | 'USER'
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          nom?: string
          role?: 'ADMIN' | 'USER'
          created_at?: string | null
          updated_at?: string | null
        }
      }
    }
  }
}
