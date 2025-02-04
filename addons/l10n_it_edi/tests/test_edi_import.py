# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from unittest.mock import MagicMock, patch

from odoo import fields, sql_db, Command
from odoo.tests import tagged
from odoo.addons.l10n_it_edi.tests.common import TestItEdi


@tagged('post_install_l10n', 'post_install', '-at_install')
class TestItEdiImport(TestItEdi):
    """ Main test class for the l10n_it_edi vendor bills XML import"""

    fake_test_content = """<?xml version="1.0" encoding="UTF-8"?>
        <p:FatturaElettronica versione="FPR12" xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
        xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2 http://www.fatturapa.gov.it/export/fatturazione/sdi/fatturapa/v1.2/Schema_del_file_xml_FatturaPA_versione_1.2.xsd">
        <FatturaElettronicaHeader>
          <DatiTrasmissione>
            <ProgressivoInvio>TWICE_TEST</ProgressivoInvio>
          </DatiTrasmissione>
          <CessionarioCommittente>
            <DatiAnagrafici>
              <CodiceFiscale>01234560157</CodiceFiscale>
            </DatiAnagrafici>
          </CessionarioCommittente>
          </FatturaElettronicaHeader>
          <FatturaElettronicaBody>
            <DatiGenerali>
              <DatiGeneraliDocumento>
                <TipoDocumento>TD02</TipoDocumento>
              </DatiGeneraliDocumento>
            </DatiGenerali>
          </FatturaElettronicaBody>
        </p:FatturaElettronica>"""

    # -----------------------------
    # Vendor bills
    # -----------------------------

    def test_receive_vendor_bill(self):
        """ Test a sample e-invoice file from
        https://www.fatturapa.gov.it/export/documenti/fatturapa/v1.2/IT01234567890_FPR01.xml
        """
        self._assert_import_invoice('IT01234567890_FPR01.xml', [{
            'invoice_date': fields.Date.from_string('2014-12-18'),
            'amount_untaxed': 5.0,
            'amount_tax': 1.1,
            'invoice_line_ids': [{
                'quantity': 5.0,
                'price_unit': 1.0,
            }],
        }])

    def test_receive_signed_vendor_bill(self):
        """ Test a signed (P7M) sample e-invoice file from
        https://www.fatturapa.gov.it/export/documenti/fatturapa/v1.2/IT01234567890_FPR01.xml
        """
        self._assert_import_invoice('IT01234567890_FPR01.xml.p7m', [{
            'name': 'BILL/2014/12/0001',
            'ref': '01234567890',
            'invoice_date': fields.Date.from_string('2014-12-18'),
            'amount_untaxed': 5.0,
            'amount_tax': 1.1,
            'invoice_line_ids': [{
                'quantity': 5.0,
                'price_unit': 1.0,
            }],
        }])

    def test_cron_receives_bill_from_another_company(self):
        """ Ensure that when from one of your company, you bill the other, the
        import isn't impeded because of conflicts with the filename """
        fattura_pa = self.env.ref('l10n_it_edi.edi_fatturaPA')
        content = self.fake_test_content.encode()

        # Our test content is not encrypted
        proxy_user = MagicMock()
        proxy_user.company_id = self.company
        proxy_user._decrypt_data.return_value = content

        other_company = self.company_data['company']
        filename = 'IT01234567890_FPR02.xml'
        def mock_commit(self):
            pass

        invoice = self.env['account.move'].with_company(other_company).create({
            'move_type': 'out_invoice',
            'invoice_line_ids': [
                Command.create({
                    'name': "something not price included",
                    'price_unit': 800.40,
                    'tax_ids': [Command.set(self.company_data['default_tax_sale'].ids)],
                }),
            ],
        })
        self.env['ir.attachment'].with_company(other_company).create({
            'name': filename,
            'datas': content,
            'res_model': 'account.move',
            'res_id': invoice.id,
        })

        with patch.object(sql_db.Cursor, "commit", mock_commit):
            fattura_pa._save_incoming_attachment_fattura_pa(
                proxy_user=proxy_user,
                id_transaction='9999999999',
                filename=filename,
                content=content,
                key=None)

        attachment = self.env['ir.attachment'].search([
            ('name', '=', 'IT01234567890_FPR02.xml'),
            ('res_model', '=', 'account.move'),
            ('company_id', '=', self.company.id),
        ])
        self.assertTrue(attachment)
        self.assertTrue(self.env['account.move'].browse(attachment.res_id))

    def test_receive_same_vendor_bill_twice(self):
        """ Test that the second time we are receiving an SdiCoop invoice, the second is discarded """

        fattura_pa = self.env.ref('l10n_it_edi.edi_fatturaPA')
        content = self.fake_test_content.encode()

        # Our test content is not encrypted
        proxy_user = MagicMock()
        proxy_user.company_id = self.company
        proxy_user._decrypt_data.return_value = content

        def mock_commit(self):
            pass

        with patch.object(sql_db.Cursor, "commit", mock_commit):
            for dummy in range(2):
                fattura_pa._save_incoming_attachment_fattura_pa(
                    proxy_user=proxy_user,
                    id_transaction='9999999999',
                    filename='IT01234567890_FPR02.xml',
                    content=content,
                    key=None)

        # There should be one attachement with this filename
        attachments = self.env['ir.attachment'].search([('name', '=', 'IT01234567890_FPR02.xml')])
        self.assertEqual(len(attachments), 1)
        invoices = self.env['account.move'].search([('payment_reference', '=', 'TWICE_TEST')])
        self.assertEqual(len(invoices), 1)

    def test_receive_bill_with_global_discount(self):
        applied_xml = """
            <xpath expr="//FatturaElettronicaBody/DatiGenerali/DatiGeneraliDocumento" position="inside">
                <ScontoMaggiorazione>
                    <Tipo>SC</Tipo>
                    <Importo>2</Importo>
                </ScontoMaggiorazione>
            </xpath>
        """

        self._assert_import_invoice('IT01234567890_FPR01.xml', [{
            'invoice_date': fields.Date.from_string('2014-12-18'),
            'amount_untaxed': 3.0,
            'amount_tax': 1.1,
            'invoice_line_ids': [
                {
                    'quantity': 5.0,
                    'name': 'DESCRIZIONE DELLA FORNITURA',
                    'price_unit': 1.0,
                },
                {
                    'quantity': 1.0,
                    'name': 'SCONTO',
                    'price_unit': -2,
                }
            ],
        }], applied_xml)
