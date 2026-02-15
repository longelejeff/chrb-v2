import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Search, Plus, Edit2, X, Save, Trash2, AlertCircle } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import type { Database } from '../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface UserFormData {
  nom: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'USER';
}

export function UsersPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ show: boolean; id: string; nom: string }>({ 
    show: false, 
    id: '', 
    nom: '' 
  });

  const [formData, setFormData] = useState<UserFormData>({
    nom: '',
    email: '',
    password: '',
    role: 'USER',
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isAdmin = profile?.role === 'ADMIN';

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  async function loadUsers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('nom');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      showToast('error', 'Erreur lors du chargement des utilisateurs.');
    } finally {
      setLoading(false);
    }
  }

  function validateForm(): boolean {
    const errors: Record<string, string> = {};

    if (!formData.nom.trim()) {
      errors.nom = 'Le nom est requis';
    }

    if (!editingUser && !formData.email.trim()) {
      errors.email = "L'email est requis";
    } else if (!editingUser && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Email invalide';
    }

    if (!editingUser && !formData.password.trim()) {
      errors.password = 'Le mot de passe est requis';
    }

    if (!editingUser && formData.password && formData.password.length < 6) {
      errors.password = 'Le mot de passe doit contenir au moins 6 caractères';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function openModal(user?: Profile) {
    if (user) {
      setEditingUser(user);
      setFormData({
        nom: user.nom,
        email: '',
        password: '',
        role: user.role,
      });
    } else {
      setEditingUser(null);
      setFormData({
        nom: '',
        email: '',
        password: '',
        role: 'USER',
      });
    }
    setFieldErrors({});
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      if (editingUser) {
        const { error: updateError } = await (supabase
          .from('profiles') as any)
          .update({
            nom: formData.nom,
            role: formData.role,
          })
          .eq('id', editingUser.id);

        if (updateError) throw updateError;
        showToast('success', 'Utilisateur modifié avec succès.');
        setShowModal(false);
        loadUsers();
      } else {
        showToast('error', 'La création d\'utilisateurs nécessite une fonction serveur.');
      }
    } catch (error: any) {
      console.error('Error saving user:', error);
      showToast('error', error.message || 'Erreur lors de la sauvegarde.');
    }
  }

  async function handleDeleteUser() {
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', confirmDelete.id);

      if (profileError) throw profileError;

      showToast('success', 'Profil utilisateur supprimé.');
      setConfirmDelete({ show: false, id: '', nom: '' });
      loadUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      showToast('error', 'Erreur lors de la suppression.');
    }
  }

  const filteredUsers = users.filter(user =>
    user.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-orange-800">Accès réservé aux administrateurs</p>
            <p className="text-sm text-orange-700 mt-1">
              Seuls les utilisateurs avec le rôle ADMIN peuvent gérer les utilisateurs.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Gestion des Utilisateurs</h2>
        <button
          onClick={() => openModal()}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm flex-shrink-0"
        >
          <Plus className="w-4 h-4 flex-shrink-0" />
          <span className="hidden sm:inline">Nouvel utilisateur</span>
          <span className="sm:hidden">Nouveau</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Rechercher par nom ou rôle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-0 px-3 py-1.5 sm:py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="overflow-x-auto -mx-3 sm:mx-0">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-slate-700">Nom</th>
                <th className="text-left py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-slate-700">Rôle</th>
                <th className="text-right py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 sm:py-3 px-3 sm:px-4">
                    <div className="text-xs sm:text-sm text-slate-700 font-medium truncate">{user.nom}</div>
                  </td>
                  <td className="py-2 sm:py-3 px-3 sm:px-4">
                    <span className={`inline-flex items-center px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium ${
                      user.role === 'ADMIN' 
                        ? 'bg-purple-100 text-purple-700' 
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="py-2 sm:py-3 px-3 sm:px-4">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openModal(user)}
                        className="p-1 sm:p-1.5 rounded text-blue-600 hover:bg-blue-50"
                        title="Modifier"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete({ show: true, id: user.id, nom: user.nom })}
                        className="p-1 sm:p-1.5 rounded text-red-600 hover:bg-red-50"
                        title="Supprimer"
                        disabled={user.id === profile?.id}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-8 text-slate-500">Aucun utilisateur trouvé</div>
        )}
      </div>

      {/* Create/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg sm:rounded-xl shadow-xl w-full max-w-md my-8">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200">
              <h3 className="text-lg sm:text-xl font-bold text-slate-800">
                {editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nom complet *
                </label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    fieldErrors.nom ? 'border-red-500' : 'border-slate-300'
                  }`}
                />
                {fieldErrors.nom && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.nom}</p>
                )}
              </div>

              {!editingUser && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        fieldErrors.email ? 'border-red-500' : 'border-slate-300'
                      }`}
                    />
                    {fieldErrors.email && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Mot de passe *
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        fieldErrors.password ? 'border-red-500' : 'border-slate-300'
                      }`}
                      placeholder="Min. 6 caractères"
                    />
                    {fieldErrors.password && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.password}</p>
                    )}
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Rôle *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'ADMIN' | 'USER' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="USER">Utilisateur</option>
                  <option value="ADMIN">Administrateur</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Save className="w-4 h-4 inline mr-2" />
                  {editingUser ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete.show && (
        <ConfirmModal
          isOpen={confirmDelete.show}
          onClose={() => setConfirmDelete({ show: false, id: '', nom: '' })}
          onConfirm={handleDeleteUser}
          title="Supprimer l'utilisateur"
          message={`Êtes-vous sûr de vouloir supprimer l'utilisateur "${confirmDelete.nom}" ? Cette action est irréversible.`}
          type="danger"
        />
      )}
    </div>
  );
}
