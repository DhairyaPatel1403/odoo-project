# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'Slovak - Accounting',
    'icon': '/account/static/description/l10n.png',
    'countries': ['sk'],
    'version': '1.0',
    'author': '26HOUSE (http://www.26house.com)',
    'website': 'https://www.odoo.com/documentation/saas-16.4/applications/finance/fiscal_localizations.html',
    'category': 'Accounting/Localizations/Account Charts',
    'description': """
Slovakia accounting chart and localization: Chart of Accounts 2020, basic VAT rates +
fiscal positions.

Tento modul definuje:
• Slovenskú účtovú osnovu za rok 2020

• Základné sadzby pre DPH z predaja a nákupu

• Základné fiškálne pozície pre slovenskú legislatívu


Pre viac informácií kontaktujte info@26house.com alebo navštívte https://www.26house.com.

    """,
    'depends': [
        'base_iban',
        'base_vat',
        'account',
    ],
    'demo': [
        'demo/demo_company.xml',
    ],
    'license': 'LGPL-3',
}
